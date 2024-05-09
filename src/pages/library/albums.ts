import GObject from "gi://GObject";

import { get_library_albums } from "libmuse";

import { AbstractLibraryPage } from "./base";

export class LibraryAlbumsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass(
      {
        GTypeName: "LibraryAlbumsPage",
      },
      this,
    );
  }

  constructor() {
    super({
      uri: "library:albums",
    });
  }

  static load = this.get_loader(get_library_albums);
}
