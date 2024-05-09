import GObject from "gi://GObject";

import { get_library_playlists } from "libmuse";

import { AbstractLibraryPage } from "./base";

export class LibraryPlaylistsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass(
      {
        GTypeName: "LibraryPlaylistsPage",
      },
      this,
    );
  }

  constructor() {
    super({
      uri: "library:playlists",
    });
  }

  static load = this.get_loader(get_library_playlists);
}
