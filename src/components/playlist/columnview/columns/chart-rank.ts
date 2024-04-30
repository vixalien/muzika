import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { PlayableContainer } from "src/util/playablelist";

class ChartRankBox extends Gtk.Box {
  static {
    GObject.registerClass({ GTypeName: "ChartRankBox" }, this);
  }

  private _rank = new Gtk.Label();
  private _change = new Gtk.Image();
  private _container = new Gtk.Box({
    valign: Gtk.Align.CENTER,
    hexpand: true,
    halign: Gtk.Align.CENTER,
    spacing: 6,
  });

  get rank() {
    return this._rank.label;
  }

  set rank(value: string) {
    this._rank.label = value;
  }

  get icon_name() {
    return this._change.icon_name;
  }

  set icon_name(value: string) {
    this._change.icon_name = value;
  }

  constructor() {
    super({
      width_request: 36,
    });

    this._rank.add_css_class("dim-label");

    this._container.append(this._rank);
    this._container.append(this._change);

    this.append(this._container);
  }
}

export class ChartRankColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "ChartRankColumn" }, this);
  }

  constructor() {
    super({
      visible: false,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const box = new ChartRankBox();

    list_item.set_child(box);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const box = list_item.child as ChartRankBox;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    if (playlist_item.rank) {
      box.rank = playlist_item.rank;

      switch (playlist_item.change) {
        case "DOWN":
          box.icon_name = "trend-down-symbolic";
          break;
        case "UP":
          box.icon_name = "trend-up-symbolic";
          break;
        default:
          box.icon_name = "trend-neutral-symbolic";
          break;
      }
    }
  }
}
