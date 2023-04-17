import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import {
  FlatSong,
  MixedContent,
  MixedItem,
  ParsedAlbum,
  ParsedPlaylist,
  ParsedSong,
  ParsedVideo,
  RelatedArtist,
} from "../muse.js";
import { load_thumbnails } from "./webimage.js";

export class SongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SongCard",
      Template:
        "resource:///org/example/TypescriptTemplate/components/songcard.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "subtitle",
        "image",
      ],
    }, this);
  }

  song?: ParsedSong;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_song(song: ParsedSong) {
    this.song = song;

    this._title.set_label(song.title);
    this._subtitle.set_label(song.artists[0].name);
    this._explicit.set_visible(song.isExplicit);

    load_thumbnails(this._image, song.thumbnails, 160);
  }
}

export class AlbumCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "AlbumCard",
      Template:
        "resource:///org/example/TypescriptTemplate/components/albumcard.ui",
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "subtitle",
        "album_type",
        "image",
      ],
    }, this);
  }

  album?: ParsedAlbum;

  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;
  _album_type!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_album(album: ParsedAlbum) {
    this.album = album;

    this._title.set_label(album.title);
    if (album.artists[0]) this._subtitle.set_label(album.artists[0].name);
    this._explicit.set_visible(album.isExplicit);
    this._album_type.set_label(album.album_type);

    load_thumbnails(this._image, album.thumbnails, 160);
  }
}

export class VideoCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "VideoCard",
      Template:
        "resource:///org/example/TypescriptTemplate/components/videocard.ui",
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "subtitle",
        "channel",
        "image",
      ],
    }, this);
  }

  video?: ParsedVideo | ParsedSong;

  _image!: Gtk.Picture;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;
  _channel!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_video(video: ParsedVideo) {
    this.video = video;

    this._title.set_label(video.title);
    this._subtitle.set_label(video.views ?? "");
    this._explicit.set_visible(false);
    this._channel.set_label(video.artists?.[0].name ?? "Video");

    load_thumbnails(this._image, video.thumbnails, 160);
  }

  set_inline_video(video: ParsedSong) {
    this.video = video;

    this._title.set_label(video.title);
    this._subtitle.set_label(video.views ?? "");
    this._explicit.set_visible(video.isExplicit);
    this._channel.set_label(video.artists[0].name ?? "");

    load_thumbnails(this._image, video.thumbnails, 160);
  }
}

export class PlaylistCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistCard",
      Template:
        "resource:///org/example/TypescriptTemplate/components/playlistcard.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "description_label",
      ],
    }, this);
  }

  playlist?: ParsedPlaylist;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _description_label!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_playlist(playlist: ParsedPlaylist) {
    this.playlist = playlist;

    this._title.set_label(playlist.title);
    this._description_label.set_label(playlist.description ?? "");

    load_thumbnails(this._image, playlist.thumbnails, 160);
  }
}

export class ArtistCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "ArtistCard",
      Template:
        "resource:///org/example/TypescriptTemplate/components/artistcard.ui",
      InternalChildren: [
        "avatar",
        "title",
        "subtitle",
      ],
    }, this);
  }

  artist?: RelatedArtist;

  _avatar!: Adw.Avatar;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_artist(artist: RelatedArtist) {
    this.artist = artist;

    this._title.set_label(artist.name);
    this._subtitle.set_label(artist.subscribers ?? "");
    this._avatar.set_name(artist.name);

    load_thumbnails(this._avatar, artist.thumbnails, 160);
  }
}

export class FlatSongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "FlatSongCard",
      Template:
        "resource:///org/example/TypescriptTemplate/components/flatsong.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "subtitle",
        "image",
      ],
    }, this);
  }

  song?: FlatSong;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_song(song: FlatSong) {
    this.song = song;

    this._title.set_label(song.title);

    if (song.artists && song.artists.length > 0) {
      this._subtitle.set_label(song.artists[0].name);
    } else {
      this._subtitle.set_label("");
    }

    this._explicit.set_visible(song.isExplicit);

    load_thumbnails(this._image, song.thumbnails, 48);
  }
}

export class MixedItemObject extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "MixedItemObject",
      Properties: {
        item: GObject.ParamSpec.object(
          "item",
          "item",
          "item",
          GObject.ParamFlags.READWRITE,
          GObject.Object.$gtype,
        ),
      },
    }, this);
  }

  item?: MixedItem;

  constructor() {
    super();
  }

  static new(item: MixedItem) {
    const obj = new MixedItemObject();
    obj.item = item;
    return obj;
  }
}

export class Carousel<
  Content extends Partial<MixedContent> & Pick<MixedContent, "contents">,
> extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "Carousel",
      Template:
        "resource:///org/example/TypescriptTemplate/components/carousel.ui",
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

  bind_cb(factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const object = list_item.get_item() as MixedItemObject;
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
    const object = this.model.get_item(position) as MixedItemObject;
    const item = object.item!;

    if (!item) return;

    let uri: string | null = null;

    switch (item.type) {
      case "playlist":
        uri = `playlist:${item.playlistId}`;
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

        this.model.append(MixedItemObject.new(item));
      }
    }
  }
}
