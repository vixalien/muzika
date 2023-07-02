import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { NavbarButton } from "./button";
import { NavbarTitle } from "./title";

export class NavbarSection extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "NavbarSection",
        Template:
          "resource:///com/vixalien/muzika/ui/components/navbar/section.ui",
        Children: [
          "items",
        ],
        Implements: [
          Gtk.Buildable,
        ],
        Properties: {
          action: GObject.ParamSpec.object(
            "action",
            "Action",
            "Action widget",
            GObject.ParamFlags.READWRITE,
            Gtk.Widget.$gtype,
          ),
          title: GObject.ParamSpec.string(
            "title",
            "title",
            "Section title",
            GObject.ParamFlags.READWRITE,
            "",
          ),
        },
      },
      this,
    );
  }

  items!: Gtk.ListBox;

  constructor() {
    super();

    this.items.set_header_func((row: Gtk.ListBoxRow) => {
      const button = row as NavbarButton;

      if (!(button instanceof NavbarButton)) return;

      if (button.title) {
        const title = new NavbarTitle();
        title.label = button.title;

        row.set_header(title);
      }
    });
  }

  vfunc_add_child(
    _builder: Gtk.Builder,
    child: GObject.Object,
    type?: string | null | undefined,
  ): void {
    if (child instanceof Gtk.Widget) {
      if (this.items) {
        this.items.append(child);
        return;
      }
    }
    super.vfunc_add_child(_builder, child, type);
  }
}
