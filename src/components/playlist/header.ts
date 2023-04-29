import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { load_thumbnails } from "../webimage.js";

import { Thumbnail } from "../../muse.js";

export class MiniPlaylistHeader extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "MiniPlaylistHeader",
      Template:
        "resource:///com/vixalien/muzika/components/playlist/miniplaylistheader.ui",
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "genre",
        "year",
        "description",
        "author_box",
        "submeta",
        "avatar",
      ],
    }, this);
  }

  _image!: Gtk.Image;
  _author_box!: Gtk.Box;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _year!: Gtk.Label;
  _genre!: Gtk.Label;
  _description!: Gtk.Label;
  _submeta!: Gtk.Box;
  _avatar!: Adw.Avatar;
}

export class LargePlaylistHeader extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "LargePlaylistHeader",
      Template:
        "resource:///com/vixalien/muzika/components/playlist/largeplaylistheader.ui",
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "genre",
        "year",
        "description",
        "author_box",
        "submeta",
        "avatar",
      ],
    }, this);
  }

  _image!: Gtk.Image;
  _author_box!: Gtk.Box;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _year!: Gtk.Label;
  _genre!: Gtk.Label;
  _description!: Gtk.Label;
  _submeta!: Gtk.Box;
  _avatar!: Adw.Avatar;
}

export class PlaylistHeader extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistHeader",
    }, this);
  }

  _large: LargePlaylistHeader;
  _mini: MiniPlaylistHeader;
  _squeezer: Adw.Squeezer;

  constructor() {
    super();
    this._squeezer = new Adw.Squeezer({
      homogeneous: false,
      transition_type: Adw.SqueezerTransitionType.CROSSFADE,
    });
    this._large = new LargePlaylistHeader();
    this._mini = new MiniPlaylistHeader();

    this._squeezer.add(this._large);
    this._squeezer.add(this._mini);

    this.append(this._squeezer);
  }

  load_thumbnails(thumbnails: Thumbnail[]) {
    load_thumbnails(this._large._image, thumbnails, 240);
    load_thumbnails(this._mini._image, thumbnails, 240);
  }

  set_description(description: string | null) {
    if (description) {
      this._large._description.set_visible(true);
      this._large._description.set_label(description);

      this._mini._description.set_visible(true);
      this._mini._description.set_label(description);
    } else {
      this._large._description.set_visible(false);

      this._mini._description.set_visible(false);
    }
  }

  set_title(title: string) {
    this._large._title.set_label(title);
    this._mini._title.set_label(title);
  }

  set_genre(genre: string) {
    this._large._genre.set_label(genre);
    this._mini._genre.set_label(genre);
  }

  add_author(author: { name: string; id: string | null; artist?: boolean }) {
    const getElements = () => {
      const link_arr = author.id ? [] : ["inactive"];

      return {
        label: new Gtk.Button({
          label: author.name,
          css_classes: ["title-3", "inline", "bold", "link", ...link_arr],
          ...(author.id
            ? {
              action_name: "app.navigate",
              action_target: GLib.Variant.new(
                "s",
                `muzika:${author.artist ? "artist" : "user"}:${author.id}`,
              ),
            }
            : {}),
        }),
        separator: new Gtk.Label({
          label: "·",
          xalign: 0,
          css_classes: ["title-3", "accent"],
        }),
      };
    };

    const largeElements = getElements();

    const miniElements = getElements();

    if (this._large._author_box.get_first_child()) {
      this._large._author_box.append(largeElements.separator);
      this._mini._author_box.append(miniElements.separator);
    }

    this._large._author_box.append(largeElements.label);

    this._mini._author_box.append(miniElements.label);
  }

  set_explicit(explicit: boolean) {
    this._large._explicit.set_visible(explicit);
    this._mini._explicit.set_visible(explicit);
  }

  set_year(year: string) {
    this._large._year.set_label(year);
    this._mini._year.set_label(year);
  }
}
