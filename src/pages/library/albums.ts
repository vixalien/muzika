import GObject from "gi://GObject";

import { get_library_albums } from "../../muse.js";
import { AbstractLibraryPage } from "./base";

export class LibraryAlbumsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass({
      GTypeName: "LibraryAlbumsPage",
    }, this);
  }

  constructor() {
    super({
      loader: get_library_albums,
      uri: "library:albums",
    });
  }
}
