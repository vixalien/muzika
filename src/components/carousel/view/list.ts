import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type { MixedItem } from "libmuse";

import { CarouselCard } from "../card.js";
import { MixedCardItem } from "src/components/library/mixedcard.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { mixed_card_activate_cb } from "./util.js";

export type RequiredMixedItem = NonNullable<MixedItem>;

export class CarouselListView extends Gtk.ListView {
  static {
    GObject.registerClass(
      {
        GTypeName: "CarouselListView",
      },
      this,
    );
  }

  items = new PlayableList<MixedCardItem>();

  constructor() {
    super({
      single_click_activate: true,
      margin_bottom: 18,
      orientation: Gtk.Orientation.HORIZONTAL,
    });

    this.connect("activate", mixed_card_activate_cb.bind(this));

    this.add_css_class("transparent");
    this.add_css_class("carousel-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    this.factory = factory;
    this.model = Gtk.NoSelection.new(this.items);
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new CarouselCard();
    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as CarouselCard;
    const container = list_item.item as PlayableContainer<MixedCardItem>;

    if (container.object) {
      card.show_item(container.object);

      (container as ContainerWithBinding).binding = container.bind_property(
        "state",
        card,
        "state",
        GObject.BindingFlags.SYNC_CREATE,
      );
    }
  }

  unbind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const container = list_item.item as PlayableContainer<MixedCardItem>;

    ((container as ContainerWithBinding).binding as GObject.Binding)?.unbind();
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

type ContainerWithBinding = PlayableContainer<MixedCardItem> & {
  binding: GObject.Binding;
};
