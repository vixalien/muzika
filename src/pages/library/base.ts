import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import { LibraryItems } from "../../muse.js";
import { LibraryView } from "../../components/library/view.js";

import type { LibraryOrder, Order } from "libmuse/types/mixins/utils.js";
import { MixedCardItem } from "src/components/library/mixedcard.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";

export const library_orders = new Map<string, LibraryOrder>([
  [_("Recent activity"), "recent_activity"],
  [_("Recently added"), "recently_added"],
  [_("Recently played"), "recently_played"],
]);

export const alphabetical_orders = new Map<string, Order>([
  [_("Recently added"), "recently_added"],
  [_("A to Z"), "a_to_z"],
  [_("Z to A"), "z_to_a"],
]);

export function order_id_to_name(string: string, orders: Map<string, string>) {
  for (const [key, value] of orders) {
    if (value === string) return key;
  }

  return null;
}

type LibraryResults = LibraryItems<MixedCardItem>;

export type LibraryLoader<PageOrder extends LibraryOrder | Order = Order> = (
  options?: {
    continuation?: string;
    signal?: AbortSignal;
    order?: PageOrder;
  },
) => Promise<LibraryResults>;

export interface LibraryPageOptions {
  orders?: Map<string, string>;
  uri: string;
}

interface LibraryState {
  results: LibraryResults;
  order?: string;
}

export class AbstractLibraryPage<PageOrder extends LibraryOrder | Order = Order>
  extends Adw.Bin
  implements MuzikaComponent<LoadedLibrary, LibraryState> {
  static {
    GObject.registerClass({
      GTypeName: "AbstractLibraryPage",
    }, this);
  }

  private view: LibraryView;
  results?: LibraryResults;

  uri: string;
  orders: Map<string, string>;
  order?: PageOrder;

  private toolbar_view: Adw.ToolbarView;

  constructor(options: LibraryPageOptions) {
    super();

    this.orders = options.orders ?? alphabetical_orders;
    this.uri = options.uri;

    this.view = new LibraryView({
      filters: Array.from((this.orders).keys()),
    });

    this.view.connect("paginate", () => {
      this.load_more();
    });

    this.toolbar_view = new Adw.ToolbarView();
    this.toolbar_view.add_top_bar(Adw.HeaderBar.new());
    this.toolbar_view.content = this.view;

    this.child = this.toolbar_view;
  }

  handle_order_changed(_: Gtk.Widget, order_name: string) {
    const order = this.orders.get(order_name);

    this.order = order as PageOrder ?? undefined;

    if (!order) return;

    const url = `muzika:${this.uri}?replace=true&order=${order}`;

    this.activate_action("navigator.visit", GLib.Variant.new_string(url));
  }

  show_library(library: LibraryResults) {
    this.view.show_items(library.items);

    this.view.reveal_paginator = library.continuation != null;
  }

  present(library: LoadedLibrary) {
    if (library.order) {
      const order = order_id_to_name(library.order, this.orders);

      if (order) this.view.set_selected_filter(order);
    }

    this.view.connect("filter-changed", this.handle_order_changed.bind(this));

    this.results = library.results;
    this.show_library(library.results);
  }

  restore_state(state: LibraryState): void {
    if (state.order) {
      const order = order_id_to_name(state.order, this.orders);

      if (order) this.view.set_selected_filter(order);
    }

    this.view.connect("filter-changed", this.handle_order_changed.bind(this));

    this.results = state.results;
    this.show_library(state.results);
  }

  get_state(): LibraryState {
    return {
      results: this.results!,
      order: this.order,
    };
  }

  loading = false;

  load_more() {
    if (this.loading || !this.results?.continuation) return;

    (this.constructor as typeof AbstractLibraryPage).loader({
      continuation: this.results.continuation,
    })
      .then((library) => {
        this.results!.continuation = library.continuation;

        this.show_library(library);

        this.view.paginator_loading = this.loading = false;
      });
  }

  static loader: LibraryLoader<LibraryOrder> | LibraryLoader<Order>;

  static get_loader(
    loader: LibraryLoader<LibraryOrder> | LibraryLoader<Order>,
  ) {
    return function (context: EndpointContext) {
      return (loader as LibraryLoader<LibraryOrder>)({
        signal: context.signal,
        order: context.url.searchParams.get("order") as LibraryOrder ??
          undefined,
      }).then((results) => {
        return {
          results,
          order: context.url.searchParams.get("order"),
        };
      });
    } as (context: EndpointContext) => Promise<LoadedLibrary>;
  }

  static load: ReturnType<typeof AbstractLibraryPage.get_loader>;
}

export interface LoadedLibrary {
  results: LibraryResults;
  order?: LibraryOrder;
}
