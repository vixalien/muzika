import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";
import { generate_song_menu } from "./util";
import { VolumeControls } from "./volume-controls";
import { bind_play_icon } from "src/player/helpers";
import { micro_to_string } from "src/util/time";

export class VideoControls extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "VideoControls",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/video/controls.ui",
        InternalChildren: [
          "multi_layout_view",
          "play_button",
          "progress_label",
          "duration_label",
          "menu_button",
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
            GObject.ParamFlags.READWRITE,
            true,
          ),
        },
      },
      this,
    );
  }

  private _multi_layout_view!: Adw.MultiLayoutView;
  private _play_button!: Gtk.Button;
  private _progress_label!: Gtk.Label;
  private _duration_label!: Gtk.Label;
  private _menu_button!: Gtk.MenuButton;

  inhibit_hide = false;

  get show_mini(): boolean {
    return this._multi_layout_view.layout_name === "mini";
  }

  set show_mini(show: boolean) {
    this._multi_layout_view.layout_name = show ? "mini" : "full";
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
        this._menu_button,
        "menu-model",
        GObject.BindingFlags.SYNC_CREATE,
        (_, media_info) => {
          const song = player.now_playing?.object.song;

          if (media_info && song) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
              const popover = this._menu_button.popover as Gtk.PopoverMenu;
              popover.add_child(new VolumeControls(), "volume-controls");
              return GLib.SOURCE_REMOVE;
            });
            return [true, generate_song_menu(song, media_info)];
          } else {
            return [true, null];
          }
        },
        null,
      ),
      this._menu_button.bind_property(
        "active",
        this,
        "inhibit-hide",
        GObject.BindingFlags.SYNC_CREATE,
      ),
    );
  }

  private listeners = new SignalListeners();

  vfunc_unmap(): void {
    this.listeners.clear();
    this.inhibit_hide = false;
    super.vfunc_unmap();
  }

  vfunc_map(): void {
    super.vfunc_map();
    this.setup_player();
  }
}
