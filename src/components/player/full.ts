import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { RepeatMode } from "../../player/queue.js";
import { load_thumbnails } from "../webimage.js";
import { Settings } from "src/application.js";
import { PlayerScale } from "./scale.js";
import { PlayerSidebarView } from "./sidebar.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { escape_label, pretty_subtitles } from "src/util/text.js";
import { MuzikaPlayer } from "src/player";

export interface FullPlayerViewOptions {
  player: MuzikaPlayer;
}

export class FullPlayerView extends Gtk.ActionBar {
  static {
    GObject.registerClass({
      GTypeName: "FullPlayerView",
      Template: "resource:///com/vixalien/muzika/ui/components/player/full.ui",
      InternalChildren: [
        "image",
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
      ],
      Signals: {
        "sidebar-button-clicked": {
          param_types: [GObject.TYPE_UINT],
        },
      },
    }, this);
  }

  _image!: Gtk.Image;
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

  player: MuzikaPlayer;

  scale: PlayerScale;

  constructor(options: FullPlayerViewOptions) {
    super();

    this.player = options.player;

    this.scale = new PlayerScale();
    this.scale.insert_after(this._scale_and_timer, this._progress_label);
    this.scale.connect("notify::value", () => {
      this._progress_label.label = micro_to_string(this.scale.value);
    });

    this.setup_player();

    this._lyrics_button.connect(
      "clicked",
      this.handle_sidebar_button.bind(this),
    );
    this._queue_button.connect(
      "clicked",
      this.handle_sidebar_button.bind(this),
    );
    this._related_button.connect(
      "clicked",
      this.handle_sidebar_button.bind(this),
    );

    [this._title, this._subtitle].forEach((label) => {
      label.connect("activate-link", (_, uri) => {
        if (uri && uri.startsWith("muzika:")) {
          this.activate_action(
            "navigator.visit",
            GLib.Variant.new_string(uri),
          );

          return true;
        }
      });
    });
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
    this.scale.value = 0;
    this._progress_label.label = seconds_to_string(0);

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

  setup_player() {
    this.song_changed();

    // update the player when the current song changes
    this.player.queue.connect(
      "notify::current",
      this.song_changed.bind(this),
    );

    this.player.connect(
      "notify::now-playing",
      this.song_meta_changed.bind(this),
    );

    this.player.connect("notify::is-buffering", () => {
      this.update_play_button();
    });

    this.player.connect("notify::playing", () => {
      this.update_play_button();
    });

    this.player.connect("notify::duration", () => {
      this.scale.set_duration(this.player.duration);
      this._duration_label.label = micro_to_string(this.player.duration);
    });

    this.scale.connect("user-changed-value", (_, value) => {
      this.activate_action(
        "player.seek",
        GLib.Variant.new_double(this.scale.value),
      );
    });

    // buttons

    this.update_repeat_button();

    this.player.queue.connect("notify::repeat", () => {
      this.update_repeat_button();
    });

    this.player.queue.connect("notify::shuffle", () => {
      this._shuffle_button.set_active(this.player.queue.shuffle);
    });

    this.setup_volume_button();

    this.player.connect("notify::timestamp", () => {
      this.scale.update_position(this.player.timestamp);
      this._progress_label.label = micro_to_string(this.player.timestamp);
    });
  }

  setup_volume_button() {
    this._volume_button.adjustment = Gtk.Adjustment.new(
      Settings.get_double("volume"),
      0,
      1,
      0.01,
      0.1,
      0,
    );

    this._volume_button.connect("value-changed", () => {
      Settings.set_double("volume", this._volume_button.adjustment.value);
    });

    Settings.connect("changed::volume", () => {
      const volume = Settings.get_double("volume");

      if (volume !== this._volume_button.adjustment.value) {
        this._volume_button.adjustment.value = volume;
      }
    });

    this._volume_button.connect(
      "query-tooltip",
      (
        _widget: Gtk.VolumeButton,
        _x: number,
        _y: number,
        _keyboard_mode: boolean,
        tooltip: Gtk.Tooltip,
      ) => {
        tooltip.set_text(
          `${Math.round(this._volume_button.adjustment.value * 100)}%`,
        );
        return true;
      },
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

  /**
   * loading multiple thumbnails can result in the previous one loading
   * after the current one, so we need to abort the previous one
   */
  abort_thumbnail: AbortController | null = null;

  show_song(track: QueueTrack) {
    if (this.abort_thumbnail != null) {
      this.abort_thumbnail.abort();
      this.abort_thumbnail = null;
    }

    // thumbnail

    this._image.icon_name = "image-missing-symbolic";

    this.abort_thumbnail = new AbortController();

    load_thumbnails(this._image, track.thumbnails, {
      width: 74,
      signal: this.abort_thumbnail.signal,
    });
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
}

function seconds_to_string(seconds: number) {
  // show the duration in the format "mm:ss"
  // show hours if the duration is longer than an hour

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  seconds = Math.floor(seconds % 60);

  let string = "";

  if (hours > 0) {
    string += hours.toString().padStart(2, "0") + ":";
  }

  string += minutes.toString().padStart(2, "0") + ":";

  string += seconds.toString().padStart(2, "0");

  return string;
}

function micro_to_seconds(micro: number) {
  return micro / 1000000;
}

function micro_to_string(micro: number) {
  return seconds_to_string(micro_to_seconds(micro));
}
