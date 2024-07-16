import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { get_library_songs, LibrarySongs } from "libmuse";
import type { Order } from "libmuse";

import { alphabetical_orders, order_id_to_name } from "./base.js";
import { Paginator } from "src/components/paginator.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";
import { add_toast } from "src/util/window.js";

// make sure paginator is registered before LibrarySongsPage
GObject.type_ensure(Paginator.$gtype);

export class LibrarySongsPage
  extends Adw.Bin
  implements MuzikaPageWidget<LoadedSongs, LibrarySongsState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "LibrarySongsPage",
        Template:
          "resource:///com/vixalien/muzika/ui/components/library/songs.ui",
        InternalChildren: ["item_view", "drop_down", "paginator", "scrolled"],
      },
      this,
    );
  }

  private _drop_down!: Gtk.DropDown;
  private _paginator!: Paginator;
  private _item_view!: PlaylistItemView;
  private _scrolled!: Gtk.ScrolledWindow;

  private items = new PlayableList();

  uri = "library:songs";
  loader = get_library_songs;
  results?: LibrarySongs;
  filters = Array.from(alphabetical_orders.keys());
  order?: Order;

  constructor() {
    super();

    this._item_view.model = Gtk.MultiSelection.new(this.items);

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

    this.order = (order as Order) ?? undefined;

    if (!order) return;

    const url = `muzika:${this.uri}?order=${order}`;

    this.activate_action("navigator.replace", GLib.Variant.new_string(url));
  }

  loading = false;

  load_more() {
    if (this.loading || !this.results?.continuation) return;

    this.loader({ continuation: this.results.continuation })
      .then((library) => {
        if (!this.results) return;

        this.results.items.push(...library.items);
        this.results.continuation = library.continuation;

        this.show_library(library);
      })
      .catch(() => {
        add_toast(_("Couldn't get more library songs"));
      })
      .finally(() => {
        this._paginator.loading = this.loading = false;
      });
  }

  show_library(library: LibrarySongs) {
    this.items.splice(
      this.items.n_items,
      0,
      library.items.map(PlayableContainer.new_from_playlist_item),
    );

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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      results: this.results!,
      order: this.order,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: LibrarySongsState): void {
    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);

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

  static load(context: PageLoadContext): Promise<LoadedSongs> {
    return get_library_songs({
      signal: context.signal,
      order: (context.url.searchParams.get("order") as Order) ?? undefined,
    }).then((results) => {
      return {
        results,
        order: (context.url.searchParams.get("order") as Order) ?? undefined,
      };
    });
  }
}

interface LoadedSongs {
  results: LibrarySongs;
  order?: Order;
}

interface LibrarySongsState extends VScrollState {
  results: LibrarySongs;
  order?: string;
}
