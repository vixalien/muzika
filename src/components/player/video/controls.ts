import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { MiniVideoControls } from "./mini";
import { FullVideoControls } from "./full";
import { SignalListeners } from "src/util/signal-listener";

MiniVideoControls;
FullVideoControls;

export class VideoControls extends Adw.Bin {
  static {
    GObject.registerClass({
      GTypeName: "VideoControls",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/video/controls.ui",
      InternalChildren: [
        "stack",
        "mini",
        "full",
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
    }, this);
  }

  private _stack!: Gtk.Stack;
  private _mini!: MiniVideoControls;
  private _full!: FullVideoControls;

  inhibit_hide = false;

  get show_mini(): boolean {
    return this._stack.visible_child === this._mini;
  }

  set show_mini(show: boolean) {
    this._stack.visible_child = show ? this._mini : this._full;
  }

  private listeners = new SignalListeners();

  vfunc_unmap(): void {
    this.listeners.clear();
    this._mini.clear_listeners();
    this._full.clear_listeners();

    super.vfunc_unmap();
  }

  vfunc_map(): void {
    this.listeners.connect(this._mini, "notify::inhibit-hide", () => {
      this.inhibit_hide = this._mini.inhibit_hide;
    });

    this.listeners.connect(this._full, "notify::inhibit-hide", () => {
      this.inhibit_hide = this._full.inhibit_hide;
    });

    super.vfunc_map();
  }
}
