import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Pango from "gi://Pango";

import { escape_label } from "src/util/text";
import { PlayableContainer } from "src/util/playablelist";
import { setup_link_label } from "src/util/label";

export class AlbumColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "AlbumColumn" }, this);
  }

  constructor() {
    super({
      title: _("Album"),
      expand: true,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = new Gtk.Label({
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
      xalign: 0,
      css_classes: ["flat-links", "dim-label"],
    });

    setup_link_label(label);

    list_item.set_child(label);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = list_item.child as Gtk.Label;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    if (playlist_item.album) {
      if (playlist_item.album.id) {
        label.set_markup(
          `<a href="muzika:album:${playlist_item.album.id}?track=${playlist_item.videoId}">${escape_label(
            playlist_item.album.name,
          )}</a>`,
        );
      } else {
        label.use_markup = false;
        label.label = playlist_item.album.name;
      }

      label.tooltip_text = playlist_item.album.name;
    } else {
      label.label = "";
    }
  }
}
