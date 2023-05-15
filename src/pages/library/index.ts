import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { get_library, GetLibraryOptions, Library } from "../../muse.js";
import { LibraryView } from "../../components/library/view.js";

const orders = new Map([
  ["Recent activity", "recent_activity"],
  ["Recently added", "recently_added"],
  ["Recently played", "recently_played"],
]);

function order_id_to_name(string: string) {
  for (const [key, value] of orders) {
    if (value === string) return key;
  }

  return null;
}

export class LibraryPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "LibraryPage",
    }, this);
  }

  view: LibraryView;
  library?: Library;

  constructor() {
    super();

    this.view = new LibraryView({
      filters: Array.from(orders.keys()),
    });

    this.append(this.view);
  }

  handle_order_changed(_: Gtk.Widget, order_name: string) {
    const order = orders.get(order_name);

    if (!order) return;

    let url = `muzika:library?replace=true&order=${order}`;

    this.activate_action("navigator.visit", GLib.Variant.new_string(url));
  }

  show_library(library: Library) {
    this.view.show_items(library.results);
  }

  async load_library(options: GetLibraryOptions) {
    this.library = await get_library(options);

    if (options.order) {
      const order = order_id_to_name(options.order);

      if (order) this.view.set_selected_filter(order);
    }

    this.view.connect("filter-changed", this.handle_order_changed.bind(this));

    this.show_library(this.library);
  }
}
