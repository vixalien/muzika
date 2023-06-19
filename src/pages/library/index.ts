import GObject from "gi://GObject";

import { get_library } from "../../muse.js";

import { AbstractLibraryPage, library_orders, LibraryLoader } from "./base";
import { RequiredMixedItem } from "src/components/carousel/index.js";
import { LibraryOrder } from "libmuse/types/mixins/utils.js";

export class LibraryPage extends AbstractLibraryPage {
  static {
    GObject.registerClass({
      GTypeName: "LibraryPage",
    }, this);
  }

  constructor() {
    super({
      orders: library_orders,
      uri: "library",
    });
  }

  static loader: LibraryLoader<LibraryOrder> = async (options) => {
    const library = await get_library(options);

    return {
      continuation: library.continuation,
      items: library.results.filter(Boolean) as RequiredMixedItem[],
    };
  };

  static load = this.get_loader(this.loader);
}
