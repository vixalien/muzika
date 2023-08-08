import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { FlatSongCard, InlineSong } from "../flatsongcard";

export class InlineSongListView extends Gtk.ListView {
  static {
    GObject.registerClass({
      GTypeName: "InlineSongListView",
    }, this);
  }

  items = new PlayableList<InlineSong>();

  constructor() {
    super({
      single_click_activate: true,
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.add_css_class("transparent");
    this.add_css_class("inline-song-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;
    this.model = Gtk.NoSelection.new(this.items);
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new FlatSongCard();
    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as FlatSongCard;
    const container = list_item.item as PlayableContainer<InlineSong>;

    if (container.object) {
      card.show_item(container.object);

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
