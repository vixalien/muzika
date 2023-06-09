import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { LibraryItems } from "../../muse.js";
import { LibraryView } from "../../components/library/view.js";

import type {
  LibraryOrder,
  Order,
  PaginationOptions,
} from "libmuse/types/mixins/utils.js";
import { MixedCardItem } from "src/components/library/mixedcard.js";

export const library_orders = new Map<string, LibraryOrder>([
  ["Recent activity", "recent_activity"],
  ["Recently added", "recently_added"],
  ["Recently played", "recently_played"],
]);

export const alphabetical_orders = new Map<string, Order>([
  ["Recently added", "recently_added"],
  ["A to Z", "a_to_z"],
  ["Z to A", "z_to_a"],
]);

export function order_id_to_name(string: string, orders: Map<string, string>) {
  for (const [key, value] of orders) {
    if (value === string) return key;
  }

  return null;
}

interface LibraryOptions extends PaginationOptions {
  order?: LibraryOrder;
}

type LibraryResults = LibraryItems<MixedCardItem>;

type LibraryLoader = (
  options?: { continuation?: string; signal?: AbortSignal },
) => Promise<LibraryResults>;

export interface LibraryPageOptions {
  orders?: Map<string, string>;
  loader: LibraryLoader;
  uri: string;
}

export class AbstractLibraryPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "AbstractLibraryPage",
    }, this);
  }

  view: LibraryView;
  results?: LibraryResults;

  loader: LibraryLoader;
  uri: string;
  orders: Map<string, string>;

  constructor(options: LibraryPageOptions) {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.loader = options.loader;
    this.orders = options.orders ?? alphabetical_orders;
    this.uri = options.uri;

    this.view = new LibraryView({
      filters: Array.from((this.orders).keys()),
    });

    this.view.connect("paginate", () => {
      this.load_more();
    });

    this.append(this.view);
  }

  handle_order_changed(_: Gtk.Widget, order_name: string) {
    const order = this.orders.get(order_name);

    if (!order) return;

    let url = `muzika:${this.uri}?replace=true&order=${order}`;

    this.activate_action("navigator.visit", GLib.Variant.new_string(url));
  }

  show_library(library: LibraryResults) {
    this.view.show_items(library.items);

    this.view.reveal_paginator = library.continuation != null;
  }

  async load_library(options: LibraryOptions) {
    this.results = await this.loader(options);

    if (options.order) {
      const order = order_id_to_name(options.order, this.orders);

      if (order) this.view.set_selected_filter(order);
    }

    this.view.connect("filter-changed", this.handle_order_changed.bind(this));

    this.show_library(this.results);
  }

  loading = false;

  load_more() {
    if (this.loading || !this.results?.continuation) return;

    this.loader({ continuation: this.results.continuation })
      .then((library) => {
        this.results!.continuation = library.continuation;

        this.show_library(library);

        this.view.paginator_loading = this.loading = false;
      });
  }
}
