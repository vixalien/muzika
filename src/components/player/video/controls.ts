import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { MiniVideoControls } from "./mini";
import { FullVideoControls } from "./full";
import { SignalListeners } from "src/util/signal-listener";

GObject.type_ensure(MiniVideoControls.$gtype);
GObject.type_ensure(FullVideoControls.$gtype);

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

    super.vfunc_unmap();
  }

  vfunc_map(): void {
    this.listeners.add_bindings(
      this.bind_property(
        "inhibit-hide",
        this._mini,
        "inhibit-hide",
        GObject.BindingFlags.SYNC_CREATE,
      ),
      this.bind_property(
        "inhibit-hide",
        this._full,
        "inhibit-hide",
        GObject.BindingFlags.SYNC_CREATE,
      ),
    );

    super.vfunc_map();
  }
}
