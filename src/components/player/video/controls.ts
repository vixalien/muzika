import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";
import { generate_song_menu } from "./util";
import { VolumeControls } from "./volume-controls";
import { bind_play_icon } from "src/player/helpers";
import { micro_to_string } from "src/util/time";
import { get_volume_icon_name } from "src/util/volume";

GObject.type_ensure(VolumeControls.$gtype);

export class VideoControls extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "VideoControls",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/video/controls.ui",
        InternalChildren: [
          "play_button",
          "progress_label",
          "duration_label",
          "window_title",
          "volume_button",
          "more_button",
          "toolbar_box",
          "clamp",
        ],
        Properties: {
          "show-mini": GObject.ParamSpec.boolean(
            "show-mini",
            "Show Mini",
            "Show the minimal video player",
            GObject.ParamFlags.READWRITE,
            true,
          ),
          "inhibit-hide": GObject.ParamSpec.boolean(
            "inhibit-hide",
            "Inhibit Hide",
            "Inhibit the hiding of the controls, for example when the mouse is over them.",
            GObject.ParamFlags.READABLE,
            true,
          ),
        },
      },
      this,
    );
  }

  private _play_button!: Gtk.Button;
  private _progress_label!: Gtk.Label;
  private _duration_label!: Gtk.Label;
  private _window_title!: Adw.WindowTitle;
  private _volume_button!: Gtk.MenuButton;
  private _more_button!: Gtk.MenuButton;
  private _toolbar_box!: Gtk.Box;
  private _clamp!: Adw.Clamp;

  get show_mini() {
    return this._toolbar_box.has_css_class("sharp-corners");
  }

  set show_mini(value: boolean) {
    if (this.show_mini == value) return;

    if (value) {
      this._toolbar_box.add_css_class("sharp-corners");

      this._clamp.margin_bottom =
        this._clamp.margin_start =
        this._clamp.margin_end =
          0;
    } else {
      this._toolbar_box.remove_css_class("sharp-corners");

      this._clamp.margin_bottom =
        this._clamp.margin_start =
        this._clamp.margin_end =
          6;
    }
  }

  private setup_player() {
    const player = get_player();

    this.listeners.add_bindings(
      /// @ts-expect-error incorrect types
      player.bind_property_full(
        "timestamp",
        this._progress_label,
        "label",
        GObject.BindingFlags.SYNC_CREATE,
        (_, from) => {
          return [true, micro_to_string(player.initial_seek_to ?? from)];
        },
        null,
      ),
      /// @ts-expect-error incorrect types
      player.bind_property_full(
        "duration",
        this._duration_label,
        "label",
        GObject.BindingFlags.SYNC_CREATE,
        (_, from) => {
          return [true, micro_to_string(from)];
        },
        null,
      ),
      bind_play_icon(this._play_button),
      /// @ts-expect-error incorrect types
      player.bind_property_full(
        "media-info",
        this._more_button,
        "menu-model",
        GObject.BindingFlags.SYNC_CREATE,
        (_, media_info) => {
          const song = player.now_playing?.object.song;

          if (media_info && song) {
            return [true, generate_song_menu(song, media_info)];
          } else {
            return [true, null];
          }
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._window_title,
        "title",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          const track = player.now_playing?.object.song;

          if (!track) return [false, null];
          return [true, track.videoDetails.title];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._window_title,
        "subtitle",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          const track = player.now_playing?.object.song;

          if (!track) return [false, null];
          return [true, track.videoDetails.author];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "volume",
        this._volume_button,
        "icon-name",
        GObject.BindingFlags.SYNC_CREATE,
        (_, value) => {
          return [true, get_volume_icon_name(false, value)];
        },
        null,
      ),
    );
  }

  get inhibit_hide() {
    return this._volume_button.active || this._more_button.active;
  }

  private listeners = new SignalListeners();

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }

  vfunc_map(): void {
    super.vfunc_map();
    this.setup_player();
  }
}
