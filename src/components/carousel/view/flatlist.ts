import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type { SearchContent } from "libmuse";

import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { FlatCard, FlatCardItem, InlineSong } from "../flatcard";
import { MixedCardItem } from "src/components/library/mixedcard";
import { flat_view_activate_cb, FlatViewChildType } from "./util";

export interface FlatListViewConstructorProperties
  extends Gtk.GridView.ConstructorProperties {
  child_type: FlatViewChildType;
}

export class FlatListView extends Gtk.ListView {
  static {
    GObject.registerClass(
      {
        GTypeName: "FlatListView",
        Properties: {
          "child-type": GObject.ParamSpec.uint(
            "child-type",
            "Child Type",
            "The type of children rendered by this listview",
            GObject.ParamFlags.READWRITE,
            FlatViewChildType.INLINE_SONG,
            FlatViewChildType.MIXED_CARD,
            FlatViewChildType.INLINE_SONG,
          ),
        },
      },
      this,
    );
  }

  private _items!: PlayableList<FlatCardItem>;

  get items() {
    return this._items;
  }

  set items(items: PlayableList<FlatCardItem>) {
    this._items = items;
    this.model = Gtk.NoSelection.new(items);
  }

  child_type = FlatViewChildType.INLINE_SONG;

  constructor(props?: Partial<FlatListViewConstructorProperties>) {
    super({
      single_click_activate: true,
      ...props,
    });

    this.connect("activate", flat_view_activate_cb.bind(this));

    this.add_css_class("transparent");
    this.add_css_class("carousel-flat-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    this.factory = factory;
    this.items = new PlayableList<FlatCardItem>();
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
      switch (this.child_type) {
        case FlatViewChildType.INLINE_SONG:
          card.show_inline_song(container.object as InlineSong);
          break;
        case FlatViewChildType.SEARCH_CONTENT:
          card.show_search_item(container.object as SearchContent);
          break;
        case FlatViewChildType.MIXED_CARD:
          card.show_mixed_item(container.object as MixedCardItem);
          break;
      }

      (container as ContainerWithBinding).binding = container.bind_property(
        "state",
        card,
        "state",
        GObject.BindingFlags.SYNC_CREATE,
      );
    }
  }

  unbind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const container = list_item.item as PlayableContainer<
      InlineSong | SearchContent
    >;

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
