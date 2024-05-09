import GObject from "gi://GObject";

import { get_library_artists } from "libmuse";

import { AbstractLibraryPage } from "./base";

export class LibraryArtistsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass(
      {
        GTypeName: "LibraryArtistsPage",
      },
      this,
    );
  }

  constructor() {
    super({
      uri: "library:artists",
    });
  }

  static load = this.get_loader(get_library_artists);
}
