import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { QueueTrack } from "src/muse";
import { get_player } from "src/application";
import { MuzikaPlayer } from "src/player";
import { escape_label, pretty_subtitles } from "src/util/text";
import { SignalListeners } from "src/util/signal-listener";
import { load_thumbnails } from "src/components/webimage";
import { micro_to_string } from "src/util/time";

export class PlayerNowPlayingView extends Adw.NavigationPage {
  static {
    GObject.registerClass({
      GTypeName: "PlayerNowPlayingView",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/now-playing/view.ui",
      InternalChildren: [
        "video_counterpart",
        "music_counterpart",
        "title",
        "subtitle",
        "picture",
        "timestamp",
        "duration",
        "play_button",
        "switcher_bar",
        "overlay_bin",
      ],
      Properties: {
        switcher_stack: GObject.param_spec_object(
          "switcher-stack",
          "Switcher Stack",
          "The Stack associated with the switcher",
          Adw.ViewStack.$gtype,
          GObject.ParamFlags.READWRITE,
        ),
        switcher_visible: GObject.param_spec_boolean(
          "switcher-visible",
          "Switcher Visible",
          "Whether to show the switcher stack",
          false,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "bottom-bar-clicked": {},
      },
    }, this);
  }

  player: MuzikaPlayer;

  private _video_counterpart!: Gtk.ToggleButton;
  private _music_counterpart!: Gtk.ToggleButton;
  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _picture!: Gtk.Picture;
  private _timestamp!: Gtk.Label;
  private _duration!: Gtk.Label;
  private _play_button!: Gtk.Button;
  private _switcher_bar!: Adw.ViewSwitcherBar;
  private _overlay_bin!: Adw.Bin;

  get switcher_stack() {
    return this._switcher_bar.stack;
  }

  set switcher_stack(stack: Adw.ViewStack) {
    this._switcher_bar.stack = stack;
  }

  get switcher_visible() {
    return this._switcher_bar.reveal;
  }

  set switcher_visible(visible: boolean) {
    this._switcher_bar.reveal = visible;
  }

  constructor() {
    super();

    this.player = get_player();
  }

  private activate_link_cb(_: Gtk.Label, uri: string) {
    if (uri && uri.startsWith("muzika:")) {
      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string(uri),
      );

      return true;
    }
  }

  private listeners = new SignalListeners();

  setup_player() {
    this.song_changed();

    // update the player when the current song changes
    this.listeners.connect(
      this.player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.listeners.add_bindings(
      // @ts-expect-error incorrect types
      this.player.bind_property_full(
        "duration",
        this._duration,
        "label",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, __) => {
          return [true, micro_to_string(this.player.duration)];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      this.player.bind_property_full(
        "timestamp",
        this._timestamp,
        "label",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, __) => {
          return [true, micro_to_string(this.player.timestamp)];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      this.player.bind_property_full(
        "playing",
        this._play_button,
        "icon-name",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        (_, __) => {
          return [
            true,
            this.player.playing
              ? "media-playback-pause-symbolic"
              : "media-playback-start-symbolic",
          ];
        },
        null,
      ),
    );
  }

  song_changed() {
    // this.scale.value = this.player.timestamp;

    // this._progress_label.label = micro_to_string(this.player.timestamp);

    const song = this.player.queue.current?.object;

    if (song) {
      this.show_song(song!);
      this.update_thumbnail();
    }
  }

  show_song(track: QueueTrack) {
    // thumbnail

    this._video_counterpart.sensitive =
      this._music_counterpart.sensitive =
        !!track.counterpart;

    this._overlay_bin.visible = this.player.queue.current_is_video;

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

    // this._duration_label.label = track.duration_seconds
    //   ? seconds_to_string(track.duration_seconds)
    //   : track.duration ?? "00:00";
  }

  /**
   * loading multiple thumbnails can result in the previous one loading
   * after the current one, so we need to abort the previous one
   */
  abort_thumbnail: AbortController | null = null;

  update_thumbnail() {
    const player = get_player();

    const song = player.queue.current?.object;

    if (!song) return;

    if (this.abort_thumbnail != null) {
      this.abort_thumbnail.abort();
      this.abort_thumbnail = null;
    }

    if (player.queue.current_is_video) {
      this._picture.set_paintable(this.player.paintable);
    } else {
      this.abort_thumbnail = new AbortController();

      load_thumbnails(this._picture, song.thumbnails, {
        width: 400,
        signal: this.abort_thumbnail.signal,
        upscale: true,
      });
    }
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

  private on_gestureclick_pressed() {
    this.emit("bottom-bar-clicked");
  }
}
