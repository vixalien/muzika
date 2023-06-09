import GObject from "gi://GObject";

import { get_library_playlists } from "../../muse.js";
import { AbstractLibraryPage } from "./base";

export class LibraryPlaylistsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass({
      GTypeName: "LibraryPlaylistsPage",
    }, this);
  }

  constructor() {
    super({
      loader: get_library_playlists,
      uri: "library:playlists",
    });
  }
}
