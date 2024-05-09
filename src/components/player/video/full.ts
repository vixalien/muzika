import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";
import { micro_to_string, seconds_to_string } from "src/util/time";
import { generate_song_menu } from "./util";
import { VolumeControls } from "./volume-controls";
import { bind_play_icon } from "src/player/helpers";

export class FullVideoControls extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "FullVideoControls",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/video/full.ui",
        InternalChildren: [
          "play_button",
          "progress_label",
          "duration_label",
          "scale",
          "menu_button",
        ],
        Properties: {
          "inhibit-hide": GObject.ParamSpec.boolean(
            "inhibit-hide",
            "Inhibit Hide",
            "Inhibit the hiding of the controls, for example when the mouse is over them.",
            GObject.ParamFlags.READWRITE,
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
  private _menu_button!: Gtk.MenuButton;

  inhibit_hide = false;

  song_changed() {
    const player = get_player();

    this._progress_label.label = micro_to_string(player.timestamp);

    const track = player.queue.current?.object;

    if (track) {
      this._progress_label.label = micro_to_string(player.timestamp);

      this._duration_label.label = track.duration_seconds
        ? seconds_to_string(track.duration_seconds)
        : track.duration ?? "00:00";
    }
  }

  private media_info_changed() {
    const player = get_player();

    const song = player.now_playing?.object.song;
    const media_info = player.media_info;

    this._menu_button.set_menu_model(null);

    if (song && media_info) {
      this._menu_button.set_menu_model(generate_song_menu(song, media_info));
      const popover = this._menu_button.popover as Gtk.PopoverMenu;
      popover.add_child(new VolumeControls(), "volume-controls");
    }
  }

  private listeners = new SignalListeners();

  private setup_player() {
    const player = get_player();

    this.song_changed();
    this.media_info_changed();

    // update the player when the current song changes
    this.listeners.connect(
      player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.listeners.connect(
      player,
      "notify::media-info",
      this.media_info_changed.bind(this),
    );

    this.listeners.add_bindings(bind_play_icon(this._play_button));

    this._duration_label.label = micro_to_string(player.duration);

    this.listeners.connect(player, "notify::duration", () => {
      this._duration_label.label = micro_to_string(player.duration);
    });

    // buttons

    // this.setup_volume_button();

    this.listeners.connect(player, "notify::timestamp", () => {
      this._progress_label.label = micro_to_string(player.timestamp);
    });

    this.listeners.connect(this._menu_button, "notify::active", () => {
      this.inhibit_hide = this._menu_button.active;
    });
  }

  clear_listeners() {
    this.inhibit_hide = false;
    this.listeners.clear();
  }

  vfunc_map(): void {
    this.setup_player();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.clear_listeners();
    super.vfunc_unmap();
  }
}
