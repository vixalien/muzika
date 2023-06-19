import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { ArtistRun, PlaylistItem } from "../../muse.js";
import { DynamicImage } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";
import { pretty_subtitles } from "src/util/text.js";

export class AlbumItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "AlbumItem",
      Template: "resource:///com/vixalien/muzika/ui/components/album/item.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
      ],
      Children: [
        "dynamic_image",
      ],
    }, this);
  }

  item?: PlaylistItem;

  dynamic_image!: DynamicImage;

  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;

  constructor() {
    super({});

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

  set_item(number: number, item: PlaylistItem, playlistId?: string) {
    this.item = item;

    this.dynamic_image.track_number = number.toLocaleString();

    this._title.set_label(item.title);

    const subtitles = pretty_subtitles(item.artists ?? []);

    this._subtitle.label = subtitles.markup;
    this._subtitle.tooltip_text = subtitles.plain;

    this._explicit.set_visible(item.isExplicit);

    this.dynamic_image.setup_video(item.videoId, playlistId);
  }
}
