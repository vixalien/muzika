// Animation code borrowed from https://gitlab.gnome.org/GNOME/gnome-weather/-/blob/7769ce6f29a897a61010c4b496b60a5753e7edff/src/app/city.js#L74

import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { MixedContent, MixedItem } from "../../muse.js";
import { AlbumCard } from "./albumcard.js";
import { ArtistCard } from "./artistcard.js";
import { FlatSongCard } from "./flatsongcard.js";
import { PlaylistCard } from "./playlistcard.js";
import { SongCard } from "./songcard.js";
import { VideoCard } from "./videocard.js";
import { ObjectContainer } from "src/util/objectcontainer.js";
import { WatchPlaylistCard } from "./watchplaylistcard.js";

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
        "text_view",
        "list_view",
        "grid_view",
        "grid_scrolled",
        "list_scrolled",
        "stack",
        "buttons",
        "left_button",
        "right_button",
        "carousel_stack",
      ],
    }, this);
  }

  content?: Content;

  _stack!: Gtk.Stack;
  _grid_scrolled!: Gtk.ScrolledWindow;
  _list_scrolled!: Gtk.ScrolledWindow;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _text!: Gtk.Box;
  _text_view!: Gtk.TextView;
  _list_view!: Gtk.ListView;
  _grid_view!: Gtk.GridView;
  _left_button!: Gtk.Button;
  _right_button!: Gtk.Button;
  _carousel_stack!: Gtk.Stack;
  _buttons!: Gtk.Box;

  grid = false;

  model = Gio.ListStore.new(GObject.TYPE_OBJECT);

  constructor(params?: Partial<Gtk.Box.ConstructorProperties>) {
    super(params);

    this._list_view.remove_css_class("view");
    this._grid_view.remove_css_class("view");

    for (const scrolled of [this._grid_scrolled, this._list_scrolled]) {
      const adjustment = scrolled.get_hadjustment();
      adjustment.connect("changed", this.sync_scroll_buttons.bind(this));
      adjustment.connect("value-changed", this.sync_scroll_buttons.bind(this));
    }

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
    const visible_child = this._stack
      .get_visible_child() as Gtk.ScrolledWindow;
    const hadjustment = visible_child.get_hadjustment();

    const target = Adw.PropertyAnimationTarget.new(hadjustment, "value");
    const animation = Adw.TimedAnimation.new(
      visible_child,
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
    const visible_child = this._stack.get_visible_child() as Gtk.ScrolledWindow;
    const hadjustment = visible_child.get_hadjustment();

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

  setup(grid = false) {
    this.grid = grid;

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));

    if (grid) {
      this._stack.set_visible_child(this._grid_scrolled);

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
        case "channel":
        case "artist":
          card = new ArtistCard();
          card.set_artist(item);
          break;
        case "watch-playlist":
          card = new WatchPlaylistCard();
          card.set_watch_playlist(item);
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
        parent.margin_start = 6;
        if (this.grid) {
          parent.margin_bottom = 6;
          parent.add_css_class("br-9");
        } else {
          parent.add_css_class("br-12");
        }
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
      this._carousel_stack.visible_child = this._stack;

      this.setup(content.display == "list");

      this.model.remove_all();

      for (const item of content.contents) {
        if (!item) continue;

        this.model.append(ObjectContainer.new(item as RequiredMixedItem));
      }
    }
  }
}
