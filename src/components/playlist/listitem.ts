import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type { PlaylistItem } from "libmuse";

import { pretty_subtitles } from "src/util/text.js";
import { DynamicImage, DynamicImageStorageType } from "../dynamic-image";
import { SignalListeners } from "src/util/signal-listener.js";
import { MenuHelper } from "src/util/menu/index.js";
import { menuLikeRow } from "src/util/menu/like";
import { setup_link_label } from "src/util/label.js";
import { menuLibraryRow } from "src/util/menu/library";

export class PlaylistListItem extends Gtk.Box {
  static {
    GObject.registerClass(
      {
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
        Children: ["dynamic_image"],
        Properties: {
          "show-add-button": GObject.param_spec_boolean(
            "show-add-button",
            "Show add button",
            "Show a button to add this track to a certain playlist",
            true,
            GObject.ParamFlags.READWRITE,
          ),
        },
        Signals: {
          add: {},
        },
      },
      this,
    );
  }

  item?: PlaylistItem;

  dynamic_image!: DynamicImage;

  private _title!: Gtk.Inscription;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;
  private _chart_rank!: Gtk.Box;
  private _rank!: Gtk.Label;
  private _change!: Gtk.Image;
  private _add!: Gtk.Button;

  playlistId?: string;

  listeners = new SignalListeners();

  private menu_helper: MenuHelper;

  constructor(props: Partial<PlaylistListItemConstructorProps>) {
    super(props);

    setup_link_label(this._subtitle);

    this.menu_helper = MenuHelper.new(this);

    // show-add-column

    this.bind_property(
      "show-add-button",
      this._add,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
    );
  }

  show_add_button = false;

  set_item(
    position: number,
    item: PlaylistItem,
    playlistId?: string,
    is_editable = false,
  ) {
    this.item = item;
    this.playlistId = playlistId;

    this._title.set_text(item.title);

    if (item.artists && item.artists.length > 0) {
      this._subtitle.visible = true;
      const { markup, plain } = pretty_subtitles(item.artists ?? []);

      this._subtitle.set_markup(markup);
      this._subtitle.tooltip_text = plain;
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
          (likeStatus) => (item.likeStatus = likeStatus),
        ),
        [_("Start radio"), `queue.play-song("${item.videoId}?radio=true")`],
        [_("Play next"), `queue.add-song("${item.videoId}?next=true")`],
        [_("Add to queue"), `queue.add-song("${item.videoId}")`],
        menuLibraryRow(
          item.feedbackTokens,
          (tokens) => (item.feedbackTokens = tokens),
        ),
        [_("Save to playlist"), `win.add-to-playlist("${item.videoId}")`],
        is_editable
          ? [_("Remove from playlist"), `playlist.remove-tracks([${position}])`]
          : null,
        item.album
          ? [
              _("Go to album"),
              `navigator.visit("muzika:album:${item.album.id}")`,
            ]
          : null,
        item.artists.length > 0
          ? [
              _("Go to artist"),
              `navigator.visit("muzika:artist:${item.artists[0].id}")`,
            ]
          : null,
      ];
    });
  }

  private add_cb() {
    this.emit("add");
  }

  clear() {
    this.listeners.clear();
  }
}

interface PlaylistListItemConstructorProps
  extends Gtk.Box.ConstructorProperties {
  show_add_button: boolean;
}
