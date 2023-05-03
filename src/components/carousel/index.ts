import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { MixedContent, MixedItem } from "../../muse.js";
import { AlbumCard } from "./albumcard.js";
import { ArtistCard } from "./artistcard.js";
import { FlatSongCard } from "./flatsongcard.js";
import { PlaylistCard } from "./playlistcard.js";
import { SongCard } from "./songcard.js";
import { VideoCard } from "./videocard.js";
import { ObjectContainer } from "src/util/objectcontainer.js";

export type RequiredMixedItem = NonNullable<MixedItem>;

export class Carousel<
  Content extends Partial<MixedContent> & Pick<MixedContent, "contents">,
> extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "Carousel",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/carousel.ui",
      InternalChildren: [
        "title",
        "subtitle",
        "text",
        "text_label",
        "list_view",
        "grid_view",
        "grid_scrolled",
        "list_scrolled",
        "scrolled_box",
      ],
    }, this);
  }

  content?: Content;

  _scrolled_box!: Gtk.Box;
  _grid_scrolled!: Gtk.ScrolledWindow;
  _list_scrolled!: Gtk.ScrolledWindow;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _text!: Gtk.Label;
  _text_label!: Gtk.Label;
  _list_view!: Gtk.ListView;
  _grid_view!: Gtk.GridView;

  grid = false;

  model = Gio.ListStore.new(GObject.TYPE_OBJECT);

  constructor(params?: Partial<Gtk.Box.ConstructorProperties>) {
    super(params);

    this._list_view.remove_css_class("view");
    this._grid_view.remove_css_class("view");
  }

  setup(grid = false) {
    this.grid = grid;

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));

    if (grid) {
      this._grid_scrolled.visible = true;
      this._list_scrolled.visible = false;

      this._grid_view.factory = factory;
      this._grid_view.model = Gtk.NoSelection.new(this.model);
      this._grid_view.connect("activate", this.activate_cb.bind(this));
    } else {
      this._list_view.factory = factory;
      this._list_view.model = Gtk.NoSelection.new(this.model);
      this._list_view.connect("activate", this.activate_cb.bind(this));
    }
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const object = list_item.get_item() as ObjectContainer<RequiredMixedItem>;
    const item = object.item!;

    let card;

    if (this.grid) {
      if (item.type !== "flat-song") {
        console.warn("Invalid item in list", item);
      } else {
        card = new FlatSongCard();
        card.set_song(item);
      }
    } else {
      switch (item.type) {
        case "song":
          card = new SongCard();
          card.set_song(item);
          break;
        case "inline-video":
          card = new VideoCard();
          card.set_inline_video(item);
          break;
        case "video":
          card = new VideoCard();
          card.set_video(item);
          break;
        case "album":
          card = new AlbumCard();
          card.set_album(item);
          break;
        case "playlist":
          card = new PlaylistCard();
          card.set_playlist(item);
          break;
        case "artist":
          card = new ArtistCard();
          card.set_artist(item);
          break;
        default:
          console.warn("Invalid item in carousel", item.type);
      }
    }

    if (card) {
      if (!this.grid) card.add_css_class("padding-6");

      list_item.set_child(card);

      const parent = card.get_parent();

      if (parent) {
        parent.margin_end = 6;
        if (this.grid) {
          parent.margin_bottom = 6;
          parent.add_css_class("br-9");
        } else {
          parent.add_css_class("br-12");
        }
        parent.add_css_class("background");
      }
    }
  }

  activate_cb(_list_view: Gtk.ListView, position: number) {
    const object = this.model.get_item(position) as ObjectContainer<
      RequiredMixedItem
    >;
    const item = object.item!;

    if (!item) return;

    let uri: string | null = null;

    switch (item.type) {
      case "playlist":
        uri = `playlist:${item.playlistId}`;
        break;
      case "artist":
        uri = `artist:${item.browseId}`;
        break;
      case "album":
        uri = `album:${item.browseId}`;
        break;
    }

    if (uri) {
      const root = this.get_root() as Gtk.Window;

      if (!root) return;

      const app = root.application;

      app.activate_action("navigate", GLib.Variant.new("s", "muzika:" + uri));
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
      this._text.set_label(content.contents);
      this._text.set_visible(true);
      this._scrolled_box.set_visible(false);
    } else {
      this._text.set_visible(false);
      this._scrolled_box.set_visible(true);

      this.setup(content.display == "list");

      this.model.remove_all();

      for (const item of content.contents) {
        if (!item) continue;

        this.model.append(ObjectContainer.new(item as RequiredMixedItem));
      }
    }
  }
}
