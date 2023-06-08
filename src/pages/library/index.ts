import GObject from "gi://GObject";

import { get_library } from "../../muse.js";
import { AbstractLibraryPage } from "./base";

export class LibraryPage extends AbstractLibraryPage {
  static {
    GObject.registerClass({
      GTypeName: "LibraryPage",
    }, this);
  }

  constructor() {
    super({
      loader: (options) =>
        get_library(options)
          .then((library) => {
            return {
              continuation: library.continuation,
              items: library.results,
            };
          }),
      uri: "library",
    });
  }
}
