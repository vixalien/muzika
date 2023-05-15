import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { ArtistRun, PlaylistItem } from "../../muse.js";

export class AlbumItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "AlbumItem",
      Template: "resource:///com/vixalien/muzika/components/album/item.ui",
      InternalChildren: [
        "title",
        "explicit",
        "explicit_flowbox",
        "second_line",
        "number",
      ],
    }, this);
  }

  item?: PlaylistItem;

  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _number!: Gtk.Label;
  _explicit_flowbox!: Gtk.FlowBox;
  _second_line!: Gtk.Box;

  constructor() {
    super({});
  }

  add_subsequent_middots = false;

  insert_middot(force = false) {
    const label = Gtk.Label.new("·");
    const flowchild = new Gtk.FlowBoxChild({
      halign: Gtk.Align.START,
      child: label,
    });

    if (this.add_subsequent_middots || force) {
      this._second_line.append(flowchild);
    } else {
      this.add_subsequent_middots = true;
    }
  }

  add_artist_only(artist: ArtistRun) {
    let child: Gtk.Widget;

    if (artist.id) {
      const button = new Gtk.Button({ label: artist.name });

      button.add_css_class("inline");
      button.add_css_class("flat");
      button.add_css_class("link");

      button.action_name = "navigator.visit";
      button.action_target = GLib.Variant.new(
        "s",
        `muzika:artist:${artist.id}`,
      );

      child = button;
    } else {
      const label = Gtk.Label.new(artist.name);

      child = label;
    }

    const flowchild = new Gtk.FlowBoxChild({
      halign: Gtk.Align.START,
      child: child,
    });

    flowchild.add_css_class("no-padding");

    this._second_line.append(flowchild);
  }

  add_author(artist: ArtistRun) {
    this.insert_middot();
    this.add_artist_only(artist);
  }

  set_item(number: number, item: PlaylistItem) {
    this.item = item;

    this._number.label = number.toString();

    this._title.set_label(item.title);

    if (item.artists && item.artists.length > 0) {
      this._second_line.show();
      item.artists.map((artist) => {
        this.add_author(artist);
      });
    } else {
      this._second_line.hide();
    }

    this._explicit.set_visible(item.isExplicit);
  }
}
