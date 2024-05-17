import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { PlayableContainer } from "src/util/playablelist";

export class DurationColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "DurationColumn" }, this);
  }

  constructor() {
    super({
      title: _("Time"),
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = new Gtk.Label({
      xalign: 1,
      halign: Gtk.Align.END,
      css_classes: ["dim-label", "numeric"],
    });

    list_item.set_child(label);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = list_item.child as Gtk.Label;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    label.label = playlist_item.duration ?? "";
  }
}
