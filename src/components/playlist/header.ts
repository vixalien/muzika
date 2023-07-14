import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { load_thumbnails } from "../webimage.js";

import { ArtistRun, Thumbnail } from "../../muse.js";
import { omit } from "lodash-es";
import { pretty_subtitles } from "src/util/text.js";

interface ButtonProps extends Partial<Gtk.Button.ConstructorProperties> {
  on_clicked?: () => void;
  styles?: string[];
}

interface MenuButtonProps
  extends Partial<Gtk.MenuButton.ConstructorProperties> {}

export class MiniPlaylistHeader extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "MiniPlaylistHeader",
      Template:
        "resource:///com/vixalien/muzika/ui/components/playlist/miniheader.ui",
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
        "submeta",
        "avatar",
        "subtitle_separator",
        "buttons",
        "subtitle",
      ],
    }, this);
  }

  _image!: Gtk.Image;
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
  _buttons!: Gtk.Box;
  _subtitle!: Gtk.Label;

  toggled = false;

  constructor() {
    super();

    this._more.connect("activate", () => {
      this.toggle_more(!this.toggled);

      this.emit("more-toggled", this.toggled);
    });

    const hover = new Gtk.EventControllerMotion();

    hover.connect("enter", () => {
      this._subtitle.add_css_class("hover");
    });

    hover.connect("leave", () => {
      this._subtitle.remove_css_class("hover");
    });

    this._subtitle.add_controller(hover);

    this._subtitle.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
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

  clear_buttons() {
    let child = this._buttons.get_first_child();

    while (child) {
      this._buttons.remove(child);
      child = this._buttons.get_first_child();
    }
  }
}

export class LargePlaylistHeader extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "LargePlaylistHeader",
      Template:
        "resource:///com/vixalien/muzika/ui/components/playlist/largeheader.ui",
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
        "submeta",
        "avatar",
        "subtitle_separator",
        "buttons",
        "subtitle",
      ],
    }, this);
  }

  _image!: Gtk.Image;
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
  _buttons!: Gtk.Box;
  _subtitle!: Gtk.Label;

  toggled = false;

  constructor() {
    super();

    this._more.connect("activate", () => {
      this.toggle_more(!this.toggled);

      this.emit("more-toggled", this.toggled);
    });

    const hover = new Gtk.EventControllerMotion();

    hover.connect("enter", () => {
      this._subtitle.add_css_class("hover");
    });

    hover.connect("leave", () => {
      this._subtitle.remove_css_class("hover");
    });

    this._subtitle.add_controller(hover);

    this._subtitle.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
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

  clear_buttons() {
    let child = this._buttons.get_first_child();

    while (child) {
      this._buttons.remove(child);
      child = this._buttons.get_first_child();
    }
  }
}

export class PlaylistHeader extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistHeader",
      Properties: {
        "show-large-header": GObject.ParamSpec.boolean(
          "show-large-header",
          "Show Large Header",
          "Whether to show the larger header",
          GObject.ParamFlags.READWRITE,
          true,
        ),
      },
    }, this);
  }

  _large: LargePlaylistHeader;
  _mini: MiniPlaylistHeader;
  _stack: Gtk.Stack;

  get show_large_header() {
    return this._stack.visible_child_name === "large";
  }

  set show_large_header(value: boolean) {
    this._stack.visible_child_name = value ? "large" : "mini";
  }

  constructor() {
    super();
    this._stack = new Gtk.Stack({
      vhomogeneous: false,
      hhomogeneous: false,
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

    this._stack.add_named(this._large, "large");
    this._stack.add_named(this._mini, "mini");

    this.append(this._stack);
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

  set_subtitle(
    subtitle: string | (null | string | ArtistRun)[],
    nodes: (string | null)[] = [],
  ) {
    const subtitle_authors = [];
    const subtitle_nodes = nodes.filter(Boolean) as string[];

    if (typeof subtitle === "string") {
      subtitle_authors.push(subtitle);
    } else {
      for (const node of subtitle) {
        if (!node) continue;

        subtitle_authors.push(node);
      }
    }

    const subtitles = pretty_subtitles(
      subtitle_authors,
      subtitle_nodes,
    );

    this._large._subtitle.label = subtitles.markup;
    this._large._subtitle.tooltip_text = subtitles.plain;

    this._mini._subtitle.label = subtitles.markup;
    this._mini._subtitle.tooltip_text = subtitles.plain;
  }

  set_explicit(explicit: boolean) {
    this._large._explicit.set_visible(explicit);
    this._mini._explicit.set_visible(explicit);
  }

  set_year(year: string | null) {
    this._large.set_year(year);
    this._mini.set_year(year);
  }

  private new_button(props: ButtonProps) {
    const button = new Gtk.Button(omit(props, ["styles", "on_clicked"]));

    if (props.icon_name && props.label) {
      button.child = new Adw.ButtonContent({
        icon_name: props.icon_name,
        label: props.label,
      });
    }

    if (props.on_clicked) {
      button.connect("clicked", props.on_clicked);
    }

    if (props.styles) {
      props.styles.forEach((style) => {
        button.add_css_class(style);
      });
    }

    button.add_css_class("pill");

    return button;
  }

  private new_menu_button(props: MenuButtonProps) {
    const button = new Gtk.MenuButton({
      icon_name: "view-more-symbolic",
      ...props,
    });

    button.add_css_class("flat");
    button.add_css_class("pill");
    button.add_css_class("small-pill");

    return button;
  }

  clear_buttons() {
    this._mini.clear_buttons();
    this._large.clear_buttons();
  }

  add_button(props: ButtonProps) {
    this._mini._buttons.append(this.new_button(props));
    this._large._buttons.append(this.new_button(props));
  }

  add_menu_button(props: MenuButtonProps) {
    this._mini._buttons.append(this.new_menu_button(props));
    this._large._buttons.append(this.new_menu_button(props));
  }
}
