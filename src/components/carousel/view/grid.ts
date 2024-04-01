import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type { MixedItem } from "libmuse";

import { CarouselCard } from "../card.js";
import { MixedCardItem } from "src/components/library/mixedcard.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { mixed_card_activate_cb } from "./util.js";

export type RequiredMixedItem = NonNullable<MixedItem>;

export class CarouselGridView extends Gtk.GridView {
  static {
    GObject.registerClass({
      GTypeName: "CarouselGridView",
    }, this);
  }

  private _items!: PlayableList<MixedCardItem>;

  get items() {
    return this._items;
  }

  set items(items: PlayableList<MixedCardItem>) {
    this._items = items;
    this.model = Gtk.NoSelection.new(items);
  }

  constructor(props?: Gtk.GridView.ConstructorProperties) {
    super({
      single_click_activate: true,
      orientation: Gtk.Orientation.HORIZONTAL,
      ...props,
    });

    this.connect("activate", mixed_card_activate_cb.bind(this));

    this.add_css_class("transparent");
    this.add_css_class("carousel-grid-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;

    this.items = new PlayableList<MixedCardItem>();
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new CarouselCard();
    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as CarouselCard;
    const container = list_item.item as PlayableContainer<MixedCardItem>;

    card.dynamic_image.hexpand = card.dynamic_image.vexpand = card.dynamic_image.can_expand = true;

    if (container.object) {
      card.show_item(container.object);

      container.connect("notify::state", () => {
        card.set_state(container.state);
      });
    }
  }

  unbind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as CarouselCard;
    card.clear();
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
