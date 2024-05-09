import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { MixedCardItem } from "./mixedcard.js";
import { Paginator } from "../paginator.js";
import { FlatListView } from "../carousel/view/flatlist.js";
import { CarouselGridView } from "../carousel/view/grid.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { Settings } from "src/util/settings.js";

export interface LibraryViewOptions {
  filters?: string[];
}

export class LibraryView extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "LibraryView",
        Template:
          "resource:///com/vixalien/muzika/ui/components/library/view.ui",
        InternalChildren: [
          "drop_down",
          "grid_button",
          "list_button",
          "stack",
          "tools",
          "box",
          "list",
          "grid",
          "paginator",
        ],
        Children: ["scrolled"],
        Signals: {
          "filter-changed": {
            param_types: [GObject.TYPE_STRING],
          },
          paginate: {},
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
      },
      this,
    );
  }

  private _stack!: Gtk.Stack;
  private _drop_down!: Gtk.DropDown;
  private _grid_button!: Gtk.ToggleButton;
  private _list_button!: Gtk.ToggleButton;
  private _tools!: Gtk.Box;
  private _box!: Gtk.Box;
  private _list!: FlatListView;
  private _grid!: CarouselGridView;
  private _paginator!: Paginator;

  get items() {
    return this._list.items as PlayableList<MixedCardItem>;
  }

  set items(items: PlayableList<MixedCardItem>) {
    this._list.items = this._grid.items = items;
  }

  scrolled!: Gtk.ScrolledWindow;

  get reveal_paginator() {
    return this._paginator.child_revealed;
  }

  set reveal_paginator(value: boolean) {
    this._paginator.reveal_child = value;
  }

  get paginator_loading() {
    return this._paginator.loading;
  }

  set paginator_loading(value: boolean) {
    this._paginator.loading = value;
  }

  constructor(props: LibraryViewOptions = {}) {
    super({
      vexpand: true,
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

    this.items = new PlayableList<MixedCardItem>();
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
    this.items.splice(
      this.items.get_n_items(),
      0,
      items.map(PlayableContainer.new_from_mixed_card_item),
    );
  }

  private on_list_button_toggled_cb(button: Gtk.ToggleButton) {
    Settings.set_boolean("prefer-list", button.active);

    if (button.active) {
      this._stack.visible_child = this._list;
    } else {
      this._stack.visible_child = this._grid;
    }
  }

  private paginated_cb() {
    this.emit("paginate");
  }
}
