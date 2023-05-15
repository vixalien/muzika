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
        "resource:///com/vixalien/muzika/components/playlist/miniheader.ui",
      Signals: {
        "more-toggled": {
          param_types: [GObject.TYPE_BOOLEAN],
        },
      },
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "genre",
        "year",
        "more",
        "description",
        "description_long",
        "description_stack",
        "author_box",
        "submeta",
        "avatar",
        "subtitle_separator",
      ],
    }, this);
  }

  _image!: Gtk.Image;
  _author_box!: Gtk.Box;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _year!: Gtk.Label;
  _genre!: Gtk.Label;
  _more!: Gtk.Expander;
  _description!: Gtk.Label;
  _description_long!: Gtk.Label;
  _description_stack!: Gtk.Stack;
  _submeta!: Gtk.Box;
  _avatar!: Adw.Avatar;
  _subtitle_separator!: Gtk.Label;

  toggled = false;

  constructor() {
    super();

    this._more.connect("activate", () => {
      this.toggle_more(!this.toggled);

      this.emit("more-toggled", this.toggled);
    });
  }

  toggle_more(expanded = true, update_expander = false) {
    this.toggled = expanded;

    this._description_stack.set_visible_child(
      expanded ? this._description_long : this._description,
    );

    if (update_expander) this._more.expanded = expanded;
  }

  set_description(description: string | null) {
    if (description) {
      const split = description.split("\n");

      this._description.single_line_mode = true;
      
      this._description.set_visible(true);
      this._description.set_label(split[0].trim());
      
      this._description_long.set_visible(true);
      this._description_long.set_label(description);
      
      // TODO: check if every line is ellispsized
      // when this is fixed: https://gitlab.gnome.org/GNOME/gjs/-/issues/547
      this._more.set_visible(
        this._description.get_layout().is_ellipsized() || split.length > 1,
      );
    } else {
      this._description_stack.set_visible(false);
      this._more.set_visible(false);
    }
  }

  set_year(year: string | null) {
    if (year) {
      this._year.set_label(year);
    } else {
      this._year.set_visible(false);
      this._subtitle_separator.set_visible(false);
    }
  }
}

export class LargePlaylistHeader extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "LargePlaylistHeader",
      Template:
        "resource:///com/vixalien/muzika/components/playlist/largeheader.ui",
      Signals: {
        "more-toggled": {
          param_types: [GObject.TYPE_BOOLEAN],
        },
      },
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "genre",
        "year",
        "more",
        "description",
        "description_long",
        "description_stack",
        "author_box",
        "submeta",
        "avatar",
        "subtitle_separator",
      ],
    }, this);
  }

  _image!: Gtk.Image;
  _author_box!: Gtk.Box;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _year!: Gtk.Label;
  _genre!: Gtk.Label;
  _more!: Gtk.Expander;
  _description!: Gtk.Label;
  _description_long!: Gtk.Label;
  _description_stack!: Gtk.Stack;
  _submeta!: Gtk.Box;
  _avatar!: Adw.Avatar;
  _subtitle_separator!: Gtk.Label;

  toggled = false;

  constructor() {
    super();

    this._more.connect("activate", () => {
      this.toggle_more(!this.toggled);

      this.emit("more-toggled", this.toggled);
    });
  }

  toggle_more(expanded = true, update_expander = false) {
    this.toggled = expanded;

    this._description_stack.set_visible_child(
      expanded ? this._description_long : this._description,
    );

    if (update_expander) this._more.expanded = expanded;
  }

  set_description(description: string | null) {
    if (description) {
      const split = description.split("\n");

      this._description.single_line_mode = true;

      this._description.set_visible(true);
      this._description.set_label(split[0].trim());

      this._description_long.set_visible(true);
      this._description_long.set_label(description);

      this._more.set_visible(
        this._description.get_layout().is_ellipsized() || split.length > 1,
      );
    } else {
      this._description_stack.set_visible(false);
      this._more.set_visible(false);
    }
  }

  set_year(year: string | null) {
    if (year) {
      this._year.set_label(year);
    } else {
      this._year.set_visible(false);
      this._subtitle_separator.set_visible(false);
    }
  }
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

    this._large.connect(
      "more-toggled",
      (_, value) => this._mini.toggle_more(value, true),
    );

    this._mini.connect(
      "more-toggled",
      (_, value) => this._large.toggle_more(value, true),
    );

    this._squeezer.add(this._large);
    this._squeezer.add(this._mini);

    this.append(this._squeezer);
  }

  load_thumbnails(thumbnails: Thumbnail[]) {
    load_thumbnails(this._large._image, thumbnails, 240);
    load_thumbnails(this._mini._image, thumbnails, 240);
  }

  set_description(description: string | null) {
    this._large.set_description(description);
    this._mini.set_description(description);
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
              action_name: "navigator.visit",
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
          css_classes: ["title-3"],
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

  set_year(year: string | null) {
    this._large.set_year(year);
    this._mini.set_year(year);
  }
}
