import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { PlaylistItem } from "../../muse.js";
import { DynamicImage } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";
import { pretty_subtitles } from "src/util/text.js";

export class PlaylistItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistItem",
      Template:
        "resource:///com/vixalien/muzika/ui/components/playlist/item.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "chart_rank",
        "rank",
        "change",
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
  private _chart_rank!: Gtk.Box;
  private _rank!: Gtk.Label;
  private _change!: Gtk.Image;

  playlistId?: string;

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

  set_item(item: PlaylistItem, playlistId?: string) {
    this.item = item;
    this.playlistId = playlistId;

    this._title.set_label(item.title);

    const subtitles = pretty_subtitles(item.artists ?? []);

    this._subtitle.label = subtitles.markup;
    this._subtitle.tooltip_text = subtitles.plain;

    if (item.rank) {
      this._chart_rank.visible = true;

      this._rank.label = item.rank;

      switch (item.change) {
        case "DOWN":
          this._change.icon_name = "trend-down-symbolic";
          break;
        case "UP":
          this._change.icon_name = "trend-up-symbolic";
          break;
        default:
          this._change.icon_name = "trend-neutral-symbolic";
          break;
      }
    }

    this._explicit.set_visible(item.isExplicit);

    this.dynamic_image.load_thumbnails(item.thumbnails);

    this.dynamic_image.setup_video(item.videoId, playlistId);
  }
}
