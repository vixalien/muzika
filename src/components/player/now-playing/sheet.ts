import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { MuzikaNPCover } from "./cover";
import { MuzikaNPDetailsSwitcher } from "./details/switcher";
import { MuzikaMaxHeight } from "src/components/maxheight";
import { MuzikaNPCounterpartSwitcher } from "./counterpart-switcher";

GObject.type_ensure(MuzikaNPCounterpartSwitcher.$gtype);
GObject.type_ensure(MuzikaNPCover.$gtype);
GObject.type_ensure(MuzikaNPDetailsSwitcher.$gtype);
GObject.type_ensure(MuzikaMaxHeight.$gtype);

export class MuzikaNPSheet extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPSheet",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/sheet.ui",
        InternalChildren: ["switcher", "stack"],
        Properties: {
          details_stack: GObject.param_spec_object(
            "details-stack",
            "Detais View Stack",
            "The view stack to show details switchers for",
            Gtk.Widget.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
          details: GObject.param_spec_object(
            "details",
            "details",
            "The view stack to show details switchers for",
            Gtk.Widget.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
          show_details: GObject.param_spec_boolean(
            "show-details",
            "Show Details",
            "If the details should be shown",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
      },
      this,
    );
  }

  private _switcher!: MuzikaNPDetailsSwitcher;
  private _stack!: Gtk.Stack;

  show_details = false;
  details_stack?: Adw.ViewStack;
  details?: Gtk.Widget;

  constructor() {
    super();

    // @ts-expect-error incorrect types
    this.bind_property_full(
      "show-details",
      this._stack,
      "visible-child-name",
      GObject.BindingFlags.SYNC_CREATE,
      (_, from) => {
        return [true, from ? "details" : "cover"];
      },
      null,
    );

    this.bind_property(
      "show-details",
      this._switcher,
      "show-details",
      GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
    );

    this.bind_property(
      "details-stack",
      this._switcher,
      "details-stack",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.connect("notify::details", () => {
      const prev = this._stack.get_child_by_name("details");
      if (prev === this.details) return;
      if (prev) this._stack.remove(prev);

      if (this.details) {
        this._stack.add_named(this.details, "details");
        if (this.show_details) this._stack.visible_child_name = "details";
      }
    });
  }
}
