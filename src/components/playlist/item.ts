import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { ArtistRun, PlaylistItem } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { DynamicImage } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";

export class PlaylistItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistItem",
      Template: "resource:///com/vixalien/muzika/components/playlist/item.ui",
      InternalChildren: [
        "title",
        "explicit_flowbox",
        "second_line",
      ],
      Children: [
        "dynamic_image",
      ],
    }, this);
  }

  item?: PlaylistItem;

  dynamic_image!: DynamicImage;

  private _title!: Gtk.Label;
  private _explicit_flowbox!: Gtk.FlowBox;
  private _second_line!: Gtk.Box;

  playlistId?: string;

  constructor() {
    super({});
  }

  add_subsequent_middots = false;

  insert_middot(force = false) {
    const label = Gtk.Label.new("·");

    label.add_css_class("dim-label");

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
      const button = new Gtk.Button({
        label: artist.name,
        cursor: Gdk.Cursor.new_from_name("pointer", null),
      });

      button.add_css_class("inline");
      button.add_css_class("flat");
      button.add_css_class("link");
      button.add_css_class("dim-label");

      button.action_name = "navigator.visit";
      button.action_target = GLib.Variant.new(
        "s",
        `muzika:artist:${artist.id}`,
      );

      child = button;
    } else {
      const label = Gtk.Label.new(artist.name);

      label.add_css_class("dim-label");

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

  set_item(item: PlaylistItem, playlistId?: string) {
    this.item = item;
    this.playlistId = playlistId;

    this._title.set_label(item.title);

    if (item.artists && item.artists.length > 0) {
      item.artists.map((artist) => {
        this.add_author(artist);
      });
    }

    this._explicit_flowbox.set_visible(item.isExplicit);

    load_thumbnails(this.dynamic_image.image, item.thumbnails, 48);

    this.dynamic_image.setup_listeners(item.videoId, playlistId);
  }
}
