import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { get_library_songs, LibrarySongs } from "../../muse.js";

import {
  alphabetical_orders,
  LoadedLibrary,
  order_id_to_name,
} from "./base.js";
import { Paginator } from "src/components/paginator.js";
import { PlaylistItemCard } from "src/components/playlist/item.js";
import type { Order, PaginationOptions } from "libmuse/types/mixins/utils.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";

interface LibraryOptions extends PaginationOptions {
  order?: Order;
}

// make sure paginator is registered before LibrarySongsPage
Paginator;

export class LibrarySongsPage extends Adw.Bin
  implements MuzikaComponent<LoadedSongs, LibrarySongsState> {
  static {
    GObject.registerClass({
      GTypeName: "LibrarySongsPage",
      Template:
        "resource:///com/vixalien/muzika/ui/components/library/songs.ui",
      InternalChildren: ["drop_down", "paginator"],
      Children: ["list"],
    }, this);
  }

  private _drop_down!: Gtk.DropDown;
  private _paginator!: Paginator;

  list!: Gtk.Box;

  uri = "library:songs";
  loader = get_library_songs;
  results?: LibrarySongs;
  filters = Array.from(alphabetical_orders.keys());
  order?: Order;

  constructor() {
    super();

    this._paginator.connect("activate", () => {
      this.load_more();
    });

    if (this.filters && this.filters.length >= 0) {
      const string_list = Gtk.StringList.new(this.filters);
      const selection_model = Gtk.SingleSelection.new(string_list);

      this._drop_down.model = selection_model;

      this._drop_down.connect("notify::selected", () => {
        const selected = this._drop_down.selected_item as Gtk.StringObject;
        this.handle_order_changed(selected.string);
      });
    } else {
      this._drop_down.hide();
    }
  }

  handle_order_changed(order_name: string) {
    const order = alphabetical_orders.get(order_name);

    this.order = order as Order ?? undefined;

    if (!order) return;

    let url = `muzika:${this.uri}?replace=true&order=${order}`;

    this.activate_action("navigator.visit", GLib.Variant.new_string(url));
  }

  loading = false;

  load_more() {
    if (this.loading || !this.results?.continuation) return;

    this.loader({ continuation: this.results.continuation })
      .then((library) => {
        this.results!.continuation = library.continuation;

        this.show_library(library);

        this._paginator.loading = this.loading = false;
      });
  }

  show_library(library: LibrarySongs) {
    library.items.forEach((item) => {
      if (!item) return;

      const card = new PlaylistItemCard();

      card.set_item(item);

      this.list.append(card);
    });

    this._paginator.reveal_child = library.continuation != null;
  }

  present(library: LoadedSongs) {
    if (library.order) {
      const order = order_id_to_name(library.order, alphabetical_orders);

      if (order) this.set_selected_filter(order);
    }

    this.results = library.results;
    this.show_library(library.results);
  }

  get_state(): LibrarySongsState {
    return {
      results: this.results!,
      order: this.order,
    };
  }

  restore_state(state: LibrarySongsState): void {
    if (state.order) {
      const order = order_id_to_name(state.order, alphabetical_orders);

      if (order) this.set_selected_filter(order);
    }

    this.results = state.results;
    this.show_library(state.results);
  }

  set_selected_filter(filter: string) {
    for (let i = 0; i < this._drop_down.model.get_n_items(); i++) {
      const item = this._drop_down.model.get_item(i) as Gtk.StringObject | null;

      if (!item) continue;

      const string = item.string;

      if (string === filter) {
        this._drop_down.selected = i;
        break;
      }
    }
  }

  static load(context: EndpointContext): Promise<LoadedSongs> {
    return get_library_songs({
      signal: context.signal,
      order: context.url.searchParams.get("order") as Order ??
        undefined,
    }).then((results) => {
      return {
        results,
        order: context.url.searchParams.get("order") as Order ?? undefined,
      };
    });
  }
}

interface LoadedSongs {
  results: LibrarySongs;
  order?: Order;
}

interface LibrarySongsState {
  results: LibrarySongs;
  order?: string;
}
