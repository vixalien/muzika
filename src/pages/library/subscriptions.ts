import GObject from "gi://GObject";

import { get_library_subscriptions } from "../../muse.js";
import { AbstractLibraryPage } from "./base";

export class LibrarySubscriptionsPage extends AbstractLibraryPage {
  static {
    GObject.registerClass({
      GTypeName: "LibrarySubscriptionsPage",
    }, this);
  }

  constructor() {
    super({
      loader: get_library_subscriptions,
      uri: "library:subscriptions",
    });
  }
}
