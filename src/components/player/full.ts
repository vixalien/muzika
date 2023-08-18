import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import GstAudio from "gi://GstAudio";

import { RepeatMode } from "../../player/queue.js";
import { Settings } from "src/application.js";
import { PlayerScale } from "./scale.js";
import { PlayerSidebarView } from "./sidebar.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { escape_label, pretty_subtitles } from "src/util/text.js";
import { MuzikaPlayer } from "src/player";
import { micro_to_string, seconds_to_string } from "src/util/time.js";
import { PlayerPreview } from "./preview.js";
import { SignalListeners } from "src/util/signal-listener.js";

export interface FullPlayerViewOptions {
  player: MuzikaPlayer;
}

PlayerPreview;

export class FullPlayerView extends Gtk.ActionBar {
  static {
    GObject.registerClass({
      GTypeName: "FullPlayerView",
      Template: "resource:///com/vixalien/muzika/ui/components/player/full.ui",
      InternalChildren: [
        "player_preview",
        "title",
        "subtitle",
        "shuffle_button",
        "prev_button",
        "play_button",
        "play_image",
        "next_button",
        "repeat_button",
        "progress_label",
        "duration_label",
        "volume_button",
        "queue_button",
        "lyrics_button",
        "related_button",
        "scale_and_timer",
        "music_counterpart",
        "video_counterpart",
      ],
      Signals: {
        "sidebar-button-clicked": {
          param_types: [GObject.TYPE_UINT],
        },
      },
    }, this);
  }

  _player_preview!: PlayerPreview;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _shuffle_button!: Gtk.ToggleButton;
  _prev_button!: Gtk.Button;
  _play_button!: Gtk.Button;
  _play_image!: Gtk.Image;
  _next_button!: Gtk.Button;
  _repeat_button!: Gtk.ToggleButton;
  _progress_label!: Gtk.Label;
  _duration_label!: Gtk.Label;
  _volume_button!: Gtk.VolumeButton;
  _queue_button!: Gtk.ToggleButton;
  _lyrics_button!: Gtk.ToggleButton;
  _related_button!: Gtk.ToggleButton;
  _scale_and_timer!: Gtk.Box;
  _music_counterpart!: Gtk.ToggleButton;
  _video_counterpart!: Gtk.ToggleButton;

  player: MuzikaPlayer;

  scale: PlayerScale;

  constructor(options: FullPlayerViewOptions) {
    super();

    this.player = options.player;

    this.scale = new PlayerScale();
    this.scale.insert_after(this._scale_and_timer, this._progress_label);

    this._volume_button.adjustment = Gtk.Adjustment.new(
      Settings.get_double("volume"),
      0,
      1,
      0.01,
      0.1,
      0,
    );
  }

  private buttons_map = new Map<Gtk.ToggleButton, PlayerSidebarView>([
    [this._related_button, PlayerSidebarView.RELATED],
    [this._lyrics_button, PlayerSidebarView.LYRICS],
    [this._queue_button, PlayerSidebarView.QUEUE],
  ]);

  private last_button: Gtk.ToggleButton | null = null;

  deselect_buttons() {
    if (this.last_button) {
      this.last_button.set_active(false);
      this.last_button = null;
    }
  }

  select_button(view: PlayerSidebarView) {
    for (const [button, view_] of this.buttons_map) {
      if (view_ === view) {
        button.set_active(true);
        this.last_button = button;
        break;
      }
    }
  }

  private handle_sidebar_button(toggled_button: Gtk.ToggleButton) {
    if (toggled_button === this.last_button) {
      this.deselect_buttons();
      this.emit("sidebar-button-clicked", PlayerSidebarView.NONE);
      return;
    } else {
      this.last_button = toggled_button;

      if (toggled_button.active) {
        this.emit(
          "sidebar-button-clicked",
          this.buttons_map.get(toggled_button)!,
        );
      } else {
        this.emit("sidebar-button-clicked", PlayerSidebarView.NONE);
      }
    }
  }

  song_changed() {
    this.scale.value = this.player.timestamp;

    this._progress_label.label = micro_to_string(this.player.timestamp);

    const song = this.player.queue.current?.object;

    if (song) {
      this.show_song(song!);
    }
  }

  song_meta_changed() {
    // toggle buttons

    this._lyrics_button.set_sensitive(
      this.player.queue.settings?.lyrics != null,
    );

    this._related_button.set_sensitive(
      this.player.queue.settings?.related != null,
    );
  }

  private listeners = new SignalListeners();

  setup_player() {
    this.song_changed();
    this.song_meta_changed();

    // update the player when the current song changes
    this.listeners.connect(
      this.player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.listeners.connect(
      this.player,
      "notify::now-playing",
      this.song_meta_changed.bind(this),
    );

    this.listeners.connect(this.player, "notify::is-buffering", () => {
      this.update_play_button();
    });

    this.listeners.connect(this.player, "notify::playing", () => {
      this.update_play_button();
    });

    this.update_play_button();

    this.listeners.connect(this.player, "notify::duration", () => {
      this.scale.set_duration(this.player.duration);
      this._duration_label.label = micro_to_string(this.player.duration);
    });

    this.listeners.connect(
      this.scale,
      "user-changed-value",
      (_: any) => {
        this.activate_action(
          "player.seek",
          GLib.Variant.new_double(this.scale.value),
        );
      },
    );

    // buttons

    this.listeners.connect(this.player.queue, "notify::repeat", () => {
      this.update_repeat_button();
    });

    this.update_repeat_button();

    this.listeners.connect(this.player.queue, "notify::shuffle", () => {
      this._shuffle_button.set_active(this.player.queue.shuffle);
    });

    this._shuffle_button.set_active(this.player.queue.shuffle);

    this.listeners.connect(
      this._lyrics_button,
      "clicked",
      this.handle_sidebar_button.bind(this) as any,
    );
    this.listeners.connect(
      this._queue_button,
      "clicked",
      this.handle_sidebar_button.bind(this) as any,
    );
    this.listeners.connect(
      this._related_button,
      "clicked",
      this.handle_sidebar_button.bind(this) as any,
    );

    // setting up volume button

    const volume = Settings.get_double("volume");
    this.set_volume_slider_value(volume);

    this.listeners.connect(Settings, "changed::volume", () => {
      const volume = Settings.get_double("volume");

      if (volume !== this.get_volume_slider_value()) {
        this.set_volume_slider_value(volume);
      }
    });

    this.listeners.connect(this._volume_button, "value-changed", () => {
      Settings.set_double("volume", this.get_volume_slider_value());
    });

    this.listeners.connect(this._volume_button, "query-tooltip", (
      _widget: Gtk.VolumeButton,
      _x: number,
      _y: number,
      _keyboard_mode: boolean,
      tooltip: Gtk.Tooltip,
    ) => {
      tooltip.set_text(
        `${Math.round(this.get_volume_slider_value() * 100)}%`,
      );
      return true;
    });

    this.listeners.connect(this.player, "notify::timestamp", () => {
      this.scale.update_position(this.player.timestamp);
      this._progress_label.label = micro_to_string(this.player.timestamp);
    });

    this.listeners.connect(this.scale, "notify::value", () => {
      this._progress_label.label = micro_to_string(this.scale.value);
    });

    [this._title, this._subtitle].forEach((label) => {
      this.listeners.connect(
        label,
        "activate-link",
        (_: Gtk.Label, uri: string) => {
          if (uri && uri.startsWith("muzika:")) {
            this.activate_action(
              "navigator.visit",
              GLib.Variant.new_string(uri),
            );

            return true;
          }
        },
      );
    });

    this.listeners.connect(this._player_preview, "activate", () => {
      this.activate_action("win.show-video", GLib.Variant.new_boolean(true));
    });
  }

  get_volume_slider_value() {
    return GstAudio.stream_volume_convert_volume(
      GstAudio.StreamVolumeFormat.CUBIC,
      GstAudio.StreamVolumeFormat.LINEAR,
      this._volume_button.adjustment.value,
    );
  }

  set_volume_slider_value(value: number) {
    this._volume_button.adjustment.value = GstAudio
      .stream_volume_convert_volume(
        GstAudio.StreamVolumeFormat.LINEAR,
        GstAudio.StreamVolumeFormat.CUBIC,
        value,
      );
  }

  update_repeat_button() {
    const repeat_mode = this.player.queue.repeat;

    this._repeat_button.set_active(
      repeat_mode === RepeatMode.ALL || repeat_mode === RepeatMode.ONE,
    );

    switch (repeat_mode) {
      case RepeatMode.ALL:
        this._repeat_button.icon_name = "media-playlist-repeat-symbolic";
        this._repeat_button.tooltip_text = _("Repeat All Songs");
        break;
      case RepeatMode.ONE:
        this._repeat_button.icon_name = "media-playlist-repeat-song-symbolic";
        this._repeat_button.tooltip_text = _("Repeat the Current Song");
        break;
      case RepeatMode.NONE:
        this._repeat_button.icon_name = "media-playlist-consecutive-symbolic";
        this._repeat_button.tooltip_text = _("Enable Repeat");
        break;
    }
  }

  update_play_button() {
    this.scale.buffering = this.player.is_buffering && this.player.playing;

    if (this.player.playing) {
      this._play_image.icon_name = "media-playback-pause-symbolic";
    } else {
      this._play_image.icon_name = "media-playback-start-symbolic";
    }
  }

  show_song(track: QueueTrack) {
    // thumbnail

    this._video_counterpart.sensitive =
      this._music_counterpart.sensitive =
        !!track.counterpart;

    if (this.player.queue.current_is_video) {
      this._video_counterpart.active = true;
    } else {
      this._music_counterpart.active = true;
    }

    // labels

    if (track.album) {
      this._title.set_markup(
        `<a href="muzika:album:${track.album.id}?track=${track.videoId}">${
          escape_label(track.title)
        }</a>`,
      );
      this._title.tooltip_text = track.title;
    } else {
      this._title.use_markup = false;
      this._title.label = track.title;
      this._title.tooltip_text = track.title;
    }

    const subtitle = pretty_subtitles(track.artists);

    this._subtitle.set_markup(subtitle.markup);
    this._subtitle.tooltip_text = subtitle.plain;

    this._duration_label.label = track.duration_seconds
      ? seconds_to_string(track.duration_seconds)
      : track.duration ?? "00:00";
  }

  private switch_counterpart() {
    this.player.queue.switch_counterpart();
  }

  vfunc_map(): void {
    this.listeners.clear();
    this.setup_player();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
