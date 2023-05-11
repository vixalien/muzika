import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { PlaylistItem } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { ArtistRun } from "libmuse/types/parsers/songs.js";

export class PlaylistItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistItem",
      Template:
        "resource:///com/vixalien/muzika/components/playlist/item.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "explicit_flowbox",
        "second_line",
        "image",
      ],
    }, this);
  }

  item?: PlaylistItem;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
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

      button.action_name = "app.navigate";
      button.action_target = GLib.Variant.new("s", `muzika:artist:${artist.id}`);

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

  set_item(item: PlaylistItem) {
    this.item = item;

    this._title.set_label(item.title);

    if (item.artists && item.artists.length > 0) {
      item.artists.map((artist) => {
        this.add_author(artist);
      });
    }

    this._explicit_flowbox.set_visible(item.isExplicit);

    load_thumbnails(this._image, item.thumbnails, 48);
  }
}
