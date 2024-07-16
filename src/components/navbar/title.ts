import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

export class NavbarTitle extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "NavbarTitle",
        Template:
          "resource:///com/vixalien/muzika/ui/components/navbar/title.ui",
        InternalChildren: ["label", "action"],
        Implements: [Gtk.Buildable],
        Properties: {
          action: GObject.ParamSpec.object(
            "action",
            "Action",
            "Action widget",
            GObject.ParamFlags.READWRITE,
            Gtk.Widget.$gtype,
          ),
          label: GObject.ParamSpec.string(
            "label",
            "Label",
            "Section Label",
            GObject.ParamFlags.READWRITE,
            "",
          ),
        },
      },
      this,
    );
  }

  private _label!: Gtk.Label;
  private _action!: Gtk.Box;

  get action(): Gtk.Widget | null {
    return this._action.get_first_child();
  }

  set action(action: Gtk.Widget | null) {
    const first = this._action.get_first_child();

    if (first) {
      this._action.remove(first);
    }

    if (action) {
      this._action.append(action);
    }
  }

  get label(): string {
    return this._label.label;
  }

  set label(title: string) {
    this._label.label = title;
  }
}
