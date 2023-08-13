import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { FlatSong, SearchContent } from "src/muse";
import { FlatCard, InlineSong } from "../flatcard";

export interface FlatGridViewConstructorProperties
  extends Gtk.GridView.ConstructorProperties {
  search_results: boolean;
}

export class FlatGridView extends Gtk.GridView {
  static {
    GObject.registerClass({
      GTypeName: "FlatGridView",
      Properties: {
        "search-results": GObject.ParamSpec.boolean(
          "search-results",
          "Search Results",
          "Whether the cards are search results",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
    }, this);
  }

  items = new PlayableList<FlatSong | SearchContent>();

  search_results = false;

  constructor(props: Partial<FlatGridViewConstructorProperties>) {
    super({
      single_click_activate: true,
      margin_bottom: 18,
      min_columns: 4,
      max_columns: 4,
      orientation: Gtk.Orientation.HORIZONTAL,
      ...props,
    });

    this.add_css_class("transparent");
    this.add_css_class("carousel-grid-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;
    this.model = Gtk.NoSelection.new(this.items);
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new FlatCard();
    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as FlatCard;
    const container = list_item.item as PlayableContainer<
      InlineSong | SearchContent
    >;

    if (container.object) {
      if (this.search_results) {
        card.show_search_item(container.object as SearchContent);
      } else {
        card.show_item(container.object as InlineSong);
      }

      container.connect("notify::state", () => {
        card.set_state(container.state);
      });
    }
  }

  teardown_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    list_item.child = null as any;
  }

  vfunc_map(): void {
    this.items.setup_listeners();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.items.clear_listeners();
    super.vfunc_unmap();
  }
}
