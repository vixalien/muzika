import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import type { QueueTrack } from "libmuse";

import { pretty_subtitles } from "src/util/text.js";
import { setup_link_label } from "src/util/label.js";
import { MenuHelper } from "src/util/menu/index.js";
import { menuLikeRow } from "src/util/menu/like.js";
import { menuLibraryRow } from "src/util/menu/library.js";
import { load_thumbnails } from "src/components/webimage";

export class MuzikaNPQueueItem extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPQueueItem",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/details/queueitem.ui",
        InternalChildren: ["image", "title", "explicit", "subtitle"],
      },
      this,
    );
  }

  item?: QueueTrack;

  private _image!: Gtk.Image;
  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;

  private menu_helper: MenuHelper;

  constructor() {
    super({});

    setup_link_label(this._subtitle);

    this.menu_helper = MenuHelper.new(this);
  }

  set_track(item: QueueTrack) {
    this.item = item;

    this._title.set_label(item.title);

    const subtitles = pretty_subtitles(item.artists);

    this._subtitle.set_markup(subtitles.markup);
    this._subtitle.tooltip_text = subtitles.plain;

    this._explicit.set_visible(item.isExplicit);

    load_thumbnails(this._image, item.thumbnails, 48);

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
}
