import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import type { PlaylistItem } from "libmuse";

import { pretty_subtitles } from "src/util/text.js";
import { DynamicImage, DynamicImageStorageType } from "../dynamic-image";
import { SignalListeners } from "src/util/signal-listener.js";
import { MenuHelper } from "src/util/menu/index.js";
import { menuLikeRow } from "src/util/menu/like";

export class PlaylistListItem extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistListItem",
      Template:
        "resource:///com/vixalien/muzika/ui/components/playlist/listitem.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "chart_rank",
        "rank",
        "change",
        "add",
      ],
      Children: [
        "dynamic_image",
      ],
      Properties: {
        "show-add": GObject.param_spec_boolean(
          "show-add",
          "Show Add",
          "Show Add button",
          true,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "add": {},
      },
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
  private _add!: Gtk.Button;

  playlistId?: string;

  listeners = new SignalListeners();

  private menu_helper: MenuHelper;

  constructor() {
    super({});

    this.listeners.connect(this._subtitle, "activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });

    this.menu_helper = MenuHelper.new(this);
  }

  set_item(
    position: number,
    item: PlaylistItem,
    playlistId?: string,
    editable = false,
  ) {
    this.item = item;
    this.playlistId = playlistId;

    this._title.set_label(item.title);

    if (item.artists && item.artists.length > 0) {
      this._subtitle.visible = true;
      const subtitles = pretty_subtitles(item.artists ?? []);

      this._subtitle.set_markup(subtitles.markup);
      this._subtitle.tooltip_text = subtitles.plain;
    } else {
      this._subtitle.visible = false;
    }

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

    if (
      this.dynamic_image.storage_type !== DynamicImageStorageType.TRACK_NUMBER
    ) {
      this.dynamic_image.cover_thumbnails = item.thumbnails;
    }

    this.dynamic_image.setup_video(item.videoId, playlistId);

    this.menu_helper.set_builder(() => {
      return [
        menuLikeRow(
          item.likeStatus,
          item.videoId,
          (likeStatus) => item.likeStatus = likeStatus,
        ),
        [_("Start radio"), `queue.play-song("${item.videoId}?radio=true")`],
        [_("Play next"), `queue.add-song("${item.videoId}?next=true")`],
        [_("Add to queue"), `queue.add-song("${item.videoId}")`],
        [_("Save to playlist"), `win.add-to-playlist("${item.videoId}")`],
        editable
          ? [_("Remove from playlist"), `playlist.remove-tracks([${position}])`]
          : null,
        item.album
          ? [
            _("Go to album"),
            `navigator.visit("muzika:album:${item.album.id}")`,
          ]
          : null,
        item.artists.length > 1
          ? [
            _("Go to artist"),
            `navigator.visit("muzika:artist:${item.artists[0].id}")`,
          ]
          : null,
      ];
    });
  }

  // property: show-add

  get show_add(): boolean {
    return this._add.visible;
  }

  set show_add(value: boolean) {
    this._add.visible = value;
  }

  private add_cb() {
    this.emit("add");
  }

  clear() {
    this.listeners.clear();
  }
}
