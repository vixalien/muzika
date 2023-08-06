import GObject from "gi://GObject";

import { PlaylistHeader } from "../playlist/header.js";

export class AlbumHeader extends PlaylistHeader {
  static {
    GObject.registerClass({
      GTypeName: "AlbumHeader",
    }, this);
  }
}
