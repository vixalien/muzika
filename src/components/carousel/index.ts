// Animation code borrowed from https://gitlab.gnome.org/GNOME/gnome-weather/-/blob/7769ce6f29a897a61010c4b496b60a5753e7edff/src/app/city.js#L74

import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { FlatSong, MixedContent, MixedItem } from "../../muse.js";
import { FlatSongCard } from "./flatsongcard.js";
import { ObjectContainer } from "src/util/objectcontainer.js";
import { CarouselCard } from "./card.js";
import { MixedCardItem } from "../library/mixedcard.js";

export type RequiredMixedItem = NonNullable<MixedItem>;

class CarouselListView extends Gtk.ListView {
  static {
    GObject.registerClass({
      GTypeName: "CarouselListView",
    }, this);
  }

  items = new Gio.ListStore<ObjectContainer<MixedCardItem>>({
    item_type: GObject.TYPE_OBJECT,
  });

  constructor() {
    super({
      single_click_activate: true,
      margin_bottom: 18,
      orientation: Gtk.Orientation.HORIZONTAL,
    });

    this.add_css_class("transparent");
    this.add_css_class("carousel-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;
    this.model = Gtk.NoSelection.new(this.items);
  }

  setup_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = new CarouselCard();
    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as CarouselCard;
    const container = list_item.item as ObjectContainer<MixedCardItem>;

    if (container.object) {
      card.show_item(container.object);
    }
  }

  unbind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as CarouselCard;
    card.clear();
  }

  teardown_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    list_item.child = null as any;
  }
}

class CarouselGridView extends Gtk.GridView {
  static {
    GObject.registerClass({
      GTypeName: "CarouselGridView",
    }, this);
  }

  items = new Gio.ListStore<ObjectContainer<FlatSong>>({
    item_type: GObject.TYPE_OBJECT,
  });

  constructor() {
    super({
      single_click_activate: true,
      margin_bottom: 18,
      min_columns: 4,
      max_columns: 4,
      orientation: Gtk.Orientation.HORIZONTAL,
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
    const card = new FlatSongCard();
    list_item.set_child(card);
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const card = list_item.child as FlatSongCard;
    const container = list_item.item as ObjectContainer<FlatSong>;

    if (container.object) {
      card.set_song(container.object);
    }
  }

  teardown_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    list_item.child = null as any;
  }
}

export class Carousel<
  Content extends Partial<MixedContent> & Pick<MixedContent, "contents">,
> extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "Carousel",
      Template:
        "resource:///com/vixalien/muzika/ui/components/carousel/carousel.ui",
      InternalChildren: [
        "title",
        "subtitle",
        "text",
        "text_view",
        "scrolled",
        "buttons",
        "left_button",
        "right_button",
        "carousel_stack",
      ],
    }, this);
  }

  content?: Content;

  _scrolled!: Gtk.ScrolledWindow;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _text!: Gtk.Box;
  _text_view!: Gtk.TextView;
  _left_button!: Gtk.Button;
  _right_button!: Gtk.Button;
  _carousel_stack!: Gtk.Stack;
  _buttons!: Gtk.Box;

  grid = false;

  model = Gio.ListStore.new(GObject.TYPE_OBJECT);

  constructor(params?: Partial<Gtk.Box.ConstructorProperties>) {
    super(params);

    const adjustment = this._scrolled.get_hadjustment();
    adjustment.connect("changed", this.sync_scroll_buttons.bind(this));
    adjustment.connect("value-changed", this.sync_scroll_buttons.bind(this));

    Gtk.DirectionType.RIGHT;

    this._left_button.connect(
      "clicked",
      () => this.begin_scroll_animation(Gtk.DirectionType.LEFT),
    );
    this._right_button.connect(
      "clicked",
      () => this.begin_scroll_animation(Gtk.DirectionType.RIGHT),
    );
  }

  begin_scroll_animation(
    direction: Gtk.DirectionType.RIGHT | Gtk.DirectionType.LEFT,
  ) {
    const hadjustment = this._scrolled.get_hadjustment();

    const target = Adw.PropertyAnimationTarget.new(hadjustment, "value");
    const animation = Adw.TimedAnimation.new(
      this._scrolled,
      hadjustment.value,
      (direction === Gtk.DirectionType.RIGHT)
        ? (hadjustment.value + hadjustment.page_size)
        : (hadjustment.value - hadjustment.page_size),
      400,
      target,
    );

    animation.play();
  }

  sync_scroll_buttons() {
    const hadjustment = this._scrolled.get_hadjustment();

    if (
      (hadjustment.get_upper() - hadjustment.get_lower()) ==
        hadjustment.page_size
    ) {
      this._left_button.hide();
      this._right_button.hide();
    } else {
      this._left_button.show();
      this._right_button.show();

      if (hadjustment.value == hadjustment.get_lower()) {
        this._left_button.set_sensitive(false);
        this._right_button.set_sensitive(true);
      } else if (
        hadjustment.value >= (hadjustment.get_upper() - hadjustment.page_size)
      ) {
        this._left_button.set_sensitive(true);
        this._right_button.set_sensitive(false);
      } else {
        this._left_button.set_sensitive(true);
        this._right_button.set_sensitive(true);
      }
    }
  }

  show_listview(contents: MixedItem[]) {
    const listview = new CarouselListView();

    listview.connect("activate", (_, position) => {
      const item = listview.items.get_item(position);

      this.activate_cb(item);
    });

    for (const content of contents) {
      if (!content) continue;

      listview.items.append(new ObjectContainer(content));
    }

    this._scrolled.child = listview;
  }

  show_gridview(contents: MixedItem[]) {
    const gridview = new CarouselGridView();

    gridview.connect("activate", (_, position) => {
      const item = gridview.items.get_item(position);

      this.activate_cb(item);
    });

    for (const content of contents) {
      if (!content) continue;

      if (content.type != "flat-song") {
        console.warn(
          `CarouselGridView only supports flat-song items, got: ${content.type}`,
        );
      }

      gridview.items.append(new ObjectContainer(content as FlatSong));
    }

    this._scrolled.child = gridview;
  }

  activate_cb(object: ObjectContainer<MixedCardItem> | null) {
    const item = object?.object;

    if (!item) return;

    let uri: string | null = null;

    switch (item.type) {
      case "playlist":
      case "watch-playlist":
        uri = `playlist:${item.playlistId}`;
        break;
      case "artist":
        uri = `artist:${item.browseId}`;
        break;
      case "album":
        uri = `album:${item.browseId}`;
        break;
      case "inline-video":
      case "song":
      case "video":
      case "flat-song":
        if (item.videoId) {
          this.activate_action(
            "queue.play-song",
            GLib.Variant.new_string(
              item.videoId,
            ),
          );
        }
        break;
    }

    if (uri) {
      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string("muzika:" + uri),
      );
    }
  }

  show_content(
    content: Content,
  ) {
    this._title.set_label(content.title ?? "");

    if (content.subtitle) {
      this._subtitle.set_label(content.subtitle);
      this._subtitle.set_visible(true);
    } else {
      this._subtitle.set_visible(false);
    }

    if (typeof content.contents === "string") {
      this._carousel_stack.visible_child = this._text;

      this._text_view.buffer.text = content.contents;
      this._text_view.remove_css_class("view");

      this._buttons.visible = false;
    } else {
      this._carousel_stack.visible_child = this._scrolled;

      if (content.display == "list") {
        this.show_gridview(content.contents);
      } else {
        this.show_listview(content.contents);
      }
    }
  }
}
