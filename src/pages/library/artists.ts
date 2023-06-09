import GObject from "gi://GObject";

import { get_library_artists } from "../../muse.js";
import { AbstractLibraryPage } from "./base";

export class LibraryArtistsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass({
      GTypeName: "LibraryArtistsPage",
    }, this);
  }

  constructor() {
    super({
      loader: get_library_artists,
      uri: "library:artists",
    });
  }
}
