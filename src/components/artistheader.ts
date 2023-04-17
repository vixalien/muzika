import GObject from "gi://GObject";

import { PlaylistHeader } from "./playlistheader.js";
import { Thumbnail } from "libmuse";
import { load_thumbnails } from "./webimage.js";

export class ArtistHeader extends PlaylistHeader {
  static {
    GObject.registerClass({
      GTypeName: "ArtistHeader",
    }, this);
  }

  constructor() {
    super();

    this._large._author_box.visible = false;
    this._mini._author_box.visible = false;

    this._large._submeta.visible = false;
    this._mini._submeta.visible = false;

    this._large._image.visible = false;
    this._mini._image.visible = false;

    this._large._avatar.visible = true;
    this._mini._avatar.visible = true;
  }

  load_thumbnails(thumbnails: Thumbnail[]): void {
    load_thumbnails(this._large._avatar, thumbnails, {
      width: 240,
      square: true,
    });
    load_thumbnails(this._mini._avatar, thumbnails, {
      width: 240,
      square: true,
    });
  }
}
