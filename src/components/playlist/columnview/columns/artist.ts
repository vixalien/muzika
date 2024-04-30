import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Pango from "gi://Pango";

import { pretty_subtitles } from "src/util/text";
import { PlayableContainer } from "src/util/playablelist";
import { setup_link_label } from "src/util/label";

export class ArtistColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "ArtistColumn" }, this);
  }

  constructor() {
    super({
      title: _("Artist"),
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

    const subtitle = pretty_subtitles(playlist_item.artists);

    label.set_markup(subtitle.markup);
    label.tooltip_text = subtitle.plain;
  }
}
