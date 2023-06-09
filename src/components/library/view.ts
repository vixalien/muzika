import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Grid } from "../../components/grid/index.js";
import { MixedCard, MixedCardItem } from "./mixedcard.js";
import { Settings } from "../../application.js";
import { Paginator } from "../paginator.js";

export interface LibraryViewOptions {
  filters?: string[];
}

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
        "box",
      ],
      Signals: {
        "filter-changed": {
          param_types: [GObject.TYPE_STRING],
        },
        "paginate": {},
      },
      Properties: {
        "reveal-paginator": GObject.param_spec_boolean(
          "reveal-paginator",
          "Reveal Paginator",
          "Whether to show the paginator component",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        "paginator-loading": GObject.param_spec_boolean(
          "paginator-loading",
          "Paginator Loading",
          "Whether the paginator is currently loading",
          false,
          GObject.ParamFlags.READWRITE,
        ),
      },
    }, this);
  }

  _stack!: Gtk.Stack;
  _drop_down!: Gtk.DropDown;
  _grid_button!: Gtk.ToggleButton;
  _list_button!: Gtk.ToggleButton;
  _tools!: Gtk.Box;
  _box!: Gtk.Box;

  grid: Grid;
  list: Gtk.Box;
  paginator: Paginator;

  get reveal_paginator() {
    return this.paginator.child_revealed;
  }

  set reveal_paginator(value: boolean) {
    this.paginator.reveal_child = value;
  }

  get paginator_loading() {
    return this.paginator.loading;
  }

  set paginator_loading(value: boolean) {
    this.paginator.loading = value;
  }

  constructor(props: LibraryViewOptions = {}) {
    super({
      vexpand: true,
    });

    this.grid = new Grid();
    this.grid.margin_start = 6;
    this.grid.margin_end = 12;

    this.list = new Gtk.Box({
      margin_start: 12,
      margin_end: 12,
      orientation: Gtk.Orientation.VERTICAL,
    });
    this.list.add_css_class("background");

    this._stack.add_named(this.grid, "grid");
    this._stack.add_named(this.list, "list");

    this.paginator = new Paginator();

    this.paginator.connect("activate", () => {
      this.emit("paginate");
    });

    this._box.append(this.paginator);

    this._grid_button.connect("toggled", (button) => {
      if (button.active) {
        this._stack.visible_child_name = "grid";
        Settings.set_boolean("prefer-list", false);
      }
    });

    this._list_button.connect("toggled", (button) => {
      if (button.active) {
        this._stack.visible_child_name = "list";
        Settings.set_boolean("prefer-list", true);
      }
    });

    if (Settings.get_boolean("prefer-list")) {
      this._list_button.active = true;
    } else {
      this._grid_button.active = true;
    }

    if (props.filters && props.filters.length >= 0) {
      const string_list = Gtk.StringList.new(props.filters);
      const selection_model = Gtk.SingleSelection.new(string_list);

      this._drop_down.model = selection_model;

      this._drop_down.connect("notify::selected", () => {
        const selected = this._drop_down.selected_item as Gtk.StringObject;
        this.emit("filter-changed", selected.string);
      });
    } else {
      this._drop_down.hide();
    }
  }

  set_selected_filter(filter: string) {
    let current: null | number = null;

    for (let i = 0; i < this._drop_down.model.get_n_items(); i++) {
      const item = this._drop_down.model.get_item(i) as Gtk.StringObject | null;

      if (!item) continue;

      const string = item.string;

      if (string === filter) {
        current = i;
        break;
      }
    }

    if (current == null) return;

    this._drop_down.selected = current;
  }

  show_items(items: MixedCardItem[]) {
    this.grid.show_items(items);

    items.forEach((item) => {
      if (!item) return;

      const card = new MixedCard();

      card.set_item(item);

      this.list.append(card);
    });
  }
}
