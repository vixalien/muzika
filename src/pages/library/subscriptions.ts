import GObject from "gi://GObject";

import { get_library_subscriptions } from "libmuse";

import { AbstractLibraryPage } from "./base";

export class LibrarySubscriptionsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass(
      {
        GTypeName: "LibrarySubscriptionsPage",
      },
      this,
    );
  }

  constructor() {
    super({
      uri: "library:subscriptions",
    });
  }

  static load = this.get_loader(get_library_subscriptions);
}
