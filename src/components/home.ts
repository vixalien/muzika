import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { Loading } from "./loading.js";

import {
  FlatSong,
  get_home,
  Home,
  MixedContent,
  ParsedPlaylist,
  ParsedSong,
} from "../muse.js";
import { load_image, WebImage } from "./webimage.js";

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
        "artist_label",
        "image",
      ],
    }, this);
  }

  song?: ParsedSong;

  _play_button!: Gtk.Button;
  _image!: WebImage;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _artist_label!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_song(song: ParsedSong) {
    this.song = song;

    this._title.set_label(song.title);
    this._artist_label.set_label(song.artists[0].name);
    this._explicit.set_visible(song.isExplicit);

    // load_image(this._image, song.thumbnails[0].url);
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
  _image!: WebImage;
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

    // load_image(this._image, song.thumbnails[0].url);
  }
}

export class Carousel extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "Carousel",
      Template:
        "resource:///org/example/TypescriptTemplate/components/carousel.ui",
      InternalChildren: [
        "scrolled",
        "scrolled_box",
        "title",
        "subtitle",
        "text",
        "text_label",
      ],
    }, this);
  }

  _scrolled!: Gtk.ScrolledWindow;
  _scrolled_box!: Gtk.Box;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;
  _text!: Gtk.Label;
  _text_label!: Gtk.Label;

  show_content(content: MixedContent) {
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
      this._scrolled.set_visible(false);
    } else {
      this._text.set_visible(false);
      this._scrolled.set_visible(true);

      if (content.display == "list") {
        // this is a grid of 4 items vertical, scroll to the right
        const flow = Gtk.FlowBox.new();
        flow.set_orientation(Gtk.Orientation.VERTICAL);
        flow.set_selection_mode(Gtk.SelectionMode.NONE);
        flow.set_homogeneous(true);
        flow.set_max_children_per_line(4);
        flow.set_min_children_per_line(4);
        flow.set_column_spacing(12);
        flow.set_row_spacing(12);

        for (const item of content.contents) {
          if (!item) continue;

          if (item.type !== "flat-song") {
            console.warn("Invalid item in list", item);
            continue;
          } else {
            const card = new FlatSongCard();
            card.set_song(item);
            flow.append(card);
          }
        }

        this._scrolled_box.append(flow);
      } else {
        for (const item of content.contents) {
          if (!item) continue;

          let card;

          switch (item.type) {
            case "song":
              card = new SongCard();
              card.set_song(item as ParsedSong);
              break;
            case "playlist":
              card = new PlaylistCard();
              card.set_playlist(item as ParsedPlaylist);
              break;
          }

          if (card) this._scrolled_box.append(card);
        }
      }
    }
  }
}

export class HomePage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "HomePage",
    }, this);
  }
  _scrolled: Gtk.ScrolledWindow;
  _clamp: Adw.Clamp;
  _box: Gtk.Box;
  _loading: Loading;

  home?: Home;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this._loading = new Loading();

    this._box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
    });

    this._box.append(this._loading);

    this._clamp = new Adw.Clamp({
      margin_top: 12,
      margin_bottom: 12,
    });
    this._clamp.set_child(this._box);

    this._scrolled = new Gtk.ScrolledWindow({ vexpand: true, hexpand: true });
    this._scrolled.set_child(this._clamp);
    this._scrolled.connect("edge-reached", (_, pos) => {
      this.load_more();
      // if (pos === Gtk.PositionType.BOTTOM) {
      //   this.load_home();
      // }
    });

    this.append(this._scrolled);

    this.load_home();
  }

  append_contents(result: MixedContent[]) {
    for (const content of result) {
      const carousel = new Carousel();
      carousel.show_content(content);
      carousel.insert_before(this._box, this._loading);

      const spacer = new Gtk.Separator();
      spacer.add_css_class("spacer");
      spacer.insert_before(this._box, this._loading);
    }
  }

  loading = false;
  no_more = false;

  load_more() {
    if (this.loading || this.no_more) return;

    this.loading = true;

    const result = this.load_home();

    if (result) {
      result.then(() => {
        this.loading = false;
      });
    } else {
      this.loading = false;
      this.no_more = true;
    }
  }

  check_height_and_load() {
    // check if there's empty space
    // if so, load more
    let height = 0, child = this._box.get_first_child();

    while (child) {
      height += child!.get_allocated_height();
      child = child!.get_next_sibling();
    }

    if (height < this._box.get_allocated_height()) {
      this.load_more();
    }
  }

  load_home() {
    if (!this.home) {
      this._loading.loading = true;

      return get_home({ limit: 3 })
        .then((home) => {
          this._loading.loading = false;

          this.home = home;

          this.append_contents(home.results);

          this.check_height_and_load();
        })
        .catch((e) => console.error(e.toString()));
    } else if (this.home.continuation) {
      this._loading.loading = true;

      return get_home({ continuation: this.home.continuation })
        .then((new_home) => {
          this._loading.loading = false;

          this.home!.continuation = new_home.continuation;
          this.home!.results.push(...new_home.results);

          this.append_contents(new_home.results);

          this.check_height_and_load();
        })
        .catch((e) => console.error(e.toString()));
    } else {
      return null;
    }
  }
}
