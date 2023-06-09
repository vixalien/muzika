import GObject from "gi://GObject";

import { get_library } from "../../muse.js";
import { AbstractLibraryPage, library_orders } from "./base";
import { RequiredMixedItem } from "src/components/carousel/index.js";

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
              items: library.results.filter(Boolean) as RequiredMixedItem[],
            };
          }),
      orders: library_orders,
      uri: "library",
    });
  }
}
