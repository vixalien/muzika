import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Grid } from "../../components/grid/index.js";
import { MixedCard } from "./mixedcard.js";
import { MixedItem } from "libmuse";

export class LibraryView extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "LibraryView",
      Template: "resource:///com/vixalien/muzika/components/library/view.ui",
      InternalChildren: [
        "drop_down",
        "grid_button",
        "list_button",
        "stack",
        "tools",
      ],
    }, this);
  }

  _stack!: Gtk.Stack;
  _drop_down!: Gtk.ToggleButton;
  _grid_button!: Gtk.ToggleButton;
  _list_button!: Gtk.ToggleButton;
  _tools!: Gtk.Box;

  grid: Grid;
  list: Gtk.ListBox;

  constructor() {
    super();

    this.grid = new Grid();
    this.grid.margin_start = 6;
    this.grid.margin_end = 12;

    this.list = new Gtk.ListBox({
      margin_start: 12,
      margin_end: 12,
    });
    this.list.add_css_class("background");

    this._stack.add_named(this.grid, "grid");
    this._stack.add_named(this.list, "list");

    this._grid_button.connect("toggled", (button) => {
      if (button.active) this._stack.visible_child_name = "grid";
    });

    this._list_button.connect("toggled", (button) => {
      if (button.active) this._stack.visible_child_name = "list";
    });

    this._grid_button.active = true;
  }

  show_items(items: MixedItem[]) {
    this.grid.show_items(items);

    items.forEach((item) => {
      if (!item) return;

      const card = new MixedCard();

      card.set_item(item);

      this.list.append(card);
    });
  }
}
