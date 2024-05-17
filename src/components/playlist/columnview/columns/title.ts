import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Pango from "gi://Pango";

import { PlayableContainer } from "src/util/playablelist";

class TitleBox extends Gtk.Box {
  static {
    GObject.registerClass({ GTypeName: "TitleBox" }, this);
  }

  label: Gtk.Label;
  explicit: Gtk.Image;

  constructor() {
    super({
      spacing: 6,
    });

    this.label = new Gtk.Label({
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
      xalign: 0,
    });

    this.explicit = new Gtk.Image({
      valign: Gtk.Align.CENTER,
      icon_name: "explicit-symbolic",
      css_classes: ["dim-label"],
    });

    this.append(this.label);
    this.append(this.explicit);
  }
}

export class TitleColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "TitleColumn" }, this);
  }

  constructor() {
    super({
      title: _("Song"),
      expand: true,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const title = new TitleBox();

    list_item.set_child(title);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const title = list_item.child as TitleBox;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    title.label.tooltip_text = title.label.label = playlist_item.title;
    title.explicit.visible = playlist_item.isExplicit;
  }
}
