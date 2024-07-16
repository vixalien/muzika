import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Gio from "gi://Gio";

import { match } from "path-to-regexp";

import { get_library_playlists, get_option } from "libmuse";

import { NavbarButton, NavbarButtonContructorProperties } from "./button";
import { ObjectContainer } from "src/util/objectcontainer";
import { ListView } from "gi-types/gtk4";
import { NavbarTitle } from "./title";
import { get_navigator } from "src/navigation";

export class NavbarView extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "NavbarView",
        Template:
          "resource:///com/vixalien/muzika/ui/components/navbar/index.ui",
        InternalChildren: ["search", "list_view"],
        Signals: {
          activated: {
            param_types: [GObject.TYPE_STRING],
          },
          searched: {},
        },
      },
      this,
    );
  }

  private _list_view!: ListView;
  private _search!: Gtk.SearchEntry;

  private model = new NavbarListStore();
  private filter_model = Gtk.FilterListModel.new(
    this.model,
    Gtk.CustomFilter.new((obj: GObject.Object) => {
      const button = (obj as ObjectContainer<NavbarButtonContructorProperties>)
        .object;

      const logged_in = get_option("auth").has_token();

      if (button.requires_login) {
        return logged_in;
      }

      return true;
    }),
  );
  private selection_model = Gtk.SingleSelection.new(this.filter_model);

  constructor() {
    super();

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    const header_factory = Gtk.SignalListItemFactory.new();
    // header_factory.connect("setup", this.header_setup_cb.bind(this));
    header_factory.connect("bind", this.header_bind_cb.bind(this));

    this._list_view.factory = factory;
    this._list_view.header_factory = header_factory;
    this._list_view.model = this.selection_model;

    this.selection_model.select_item(0, true);

    this._list_view.connect("activate", this.activate_cb.bind(this));

    this._search.connect("activate", () => {
      this.search();
    });

    this._search.connect("next-match", () => {
      this.search();
    });

    get_option("auth").addEventListener("token-changed", () => {
      this.update_buttons();
      this.update_playlists();
    });

    this.init_buttons();
    this.update_buttons();
    this.update_playlists();
  }

  private setup_cb(list_view: Gtk.ListView, list_item: Gtk.ListItem) {
    const button = new NavbarButton();
    list_item.child = button;
  }

  private bind_cb(list_view: Gtk.ListView, list_item: Gtk.ListItem) {
    const button = list_item.child as NavbarButton;
    button.show_button(
      list_item.get_item<ObjectContainer<NavbarButtonContructorProperties>>()
        .object,
    );
  }

  private header_setup_cb(
    list_view: Gtk.ListView,
    list_header: Gtk.ListHeader,
  ) {
    const item =
      list_header.item as ObjectContainer<NavbarButtonContructorProperties>;

    if (!item?.object.title) return;

    const title = new NavbarTitle();
    list_header.child = title;
  }

  private header_bind_cb(list_view: Gtk.ListView, list_header: Gtk.ListHeader) {
    const item =
      list_header.item as ObjectContainer<NavbarButtonContructorProperties>;

    if (item?.object.title) {
      const object = item.object;

      const title = new NavbarTitle();
      title.label = object.title ?? "";
      list_header.child = title;
    } else {
      list_header.set_child(null);
    }
  }

  private activate_cb(list_view: Gtk.ListView, position: number) {
    const item = this.model.get_item(position)?.object;

    if (item?.link) {
      this.emit("activated", item.link);
    }
  }

  private init_buttons() {
    const buttons: NavbarButtonContructorProperties[] = [
      {
        icon_name: "user-home-symbolic",
        label: _("Home"),
        link: "home",
      },
      {
        icon_name: "compass2-symbolic",
        label: _("Explore"),
        link: "explore",
      },
      {
        icon_name: "library-symbolic",
        label: _("Library"),
        link: "library",
        title: _("Library"),
        requires_login: true,
      },
      {
        icon_name: "library-artists-symbolic",
        label: _("Artists"),
        link: "library:artists",
        requires_login: true,
      },
      {
        icon_name: "music-artist-symbolic",
        label: _("Subscriptions"),
        link: "library:subscriptions",
        requires_login: true,
      },
      {
        icon_name: "library-music-symbolic",
        label: _("Albums"),
        link: "library:albums",
        requires_login: true,
      },
      {
        icon_name: "music-note-single-symbolic",
        label: _("Songs"),
        link: "library:songs",
        requires_login: true,
      },
      {
        icon_name: "history-undo-symbolic",
        label: _("History"),
        link: "history",
        requires_login: true,
      },
      {
        title: _("Playlists"),
        icon_name: "playlist-symbolic",
        label: _("All Playlists"),
        link: "library:playlists",
        requires_login: true,
      },
    ];

    this.model.splice(
      0,
      0,
      buttons.map((button) => new ObjectContainer({ ...button, pinned: true })),
    );
  }

  update_buttons() {
    const logged_in = get_option("auth").has_token();

    this.filter_model.filter.changed(
      logged_in ? Gtk.FilterChange.LESS_STRICT : Gtk.FilterChange.MORE_STRICT,
    );
  }

  clear_playlists() {
    this.model.remove_all_unpinned();
  }

  update_playlists() {
    if (get_option("auth").has_token()) {
      get_library_playlists()
        .then((playlists) => {
          this.clear_playlists();

          this.model.splice(
            this.model.n_items,
            0,
            playlists.items.map((playlist) => {
              return new ObjectContainer<NavbarButtonContructorProperties>({
                icon_name: "view-grid-symbolic",
                label: playlist.title,
                link: "playlist:" + playlist.playlistId,
                requires_login: true,
              });
            }),
          );
        })
        .catch((err) => {
          this.clear_playlists();

          throw err;
        });
    } else {
      this.clear_playlists();
    }
  }

  search() {
    const query = this._search.text;

    let uri;

    if (isValidMuzikaURI(query)) {
      uri = query;
    } else {
      uri = `muzika:search:${encodeURIComponent(query)}`;
    }

    this.activate_action("navigator.visit", GLib.Variant.new_string(uri));

    this.emit("searched");
  }

  navigated(uri: string) {
    const url = new URL("muzika:" + uri);

    const path = url.pathname.replace(/(?<!\\):/g, "/");

    this.model.foreach((item, number) => {
      const item_path = new URL("muzika:" + item.object.link).pathname.replace(
        /(?<!\\):/g,
        "/",
      );

      const match_fn = match(item_path);

      if (match_fn(path)) {
        this.selection_model.select_item(number, true);
      }
    });
  }

  set_search(query: string) {
    if (this._search.text === query) return;

    this._search.text = query;

    // move cursor to end
    this._search.set_position(query.length);
  }

  vfunc_realize(): void {
    super.vfunc_realize();

    get_navigator(this).connect("notify::current-uri", () => {
      const path = get_navigator().current_uri;

      if (path) this.navigated(path);
    });
  }
}

export class NavbarListStore<
    T extends
      NavbarButtonContructorProperties = NavbarButtonContructorProperties,
  >
  extends GObject.Object
  implements Gio.ListModel
{
  static {
    GObject.registerClass(
      {
        GTypeName: "NavbarListStore",
        Properties: {
          item_type: GObject.ParamSpec.uint64(
            "item-type",
            "Item Type",
            "The type of the items in the list",
            GObject.ParamFlags.READWRITE,
            0,
            Number.MAX_SAFE_INTEGER,
            0,
          ),
          n_items: GObject.ParamSpec.uint64(
            "n-items",
            "Number of Items",
            "The number of items in the list",
            GObject.ParamFlags.READABLE,
            0,
            Number.MAX_SAFE_INTEGER,
            0,
          ),
        },
        Implements: [Gio.ListModel, Gtk.SectionModel],
      },
      this,
    );
  }

  private array = new Array<ObjectContainer<T>>();

  get_item_type(): GObject.GType<unknown> {
    return this.vfunc_get_item_type();
  }

  get n_items(): number {
    return this.array.length;
  }

  get_n_items(): number {
    return this.n_items;
  }

  get_item(position: number): ObjectContainer<T> | null {
    return this.vfunc_get_item(position) as ObjectContainer<T> | null;
  }

  items_changed(position: number, removed: number, added: number): void {
    this.emit("items-changed", position, removed, added);

    if (removed != added) {
      this.notify("n-items");
    }
  }

  vfunc_get_item(position: number): GObject.Object | null {
    return this.array[position] ?? null;
  }

  vfunc_get_n_items(): number {
    return this.array.length;
  }

  vfunc_get_item_type(): GObject.GType<unknown> {
    return ObjectContainer.$gtype;
  }

  find(fn: (item: ObjectContainer<T>) => boolean): number | null {
    const index = this.array.findIndex(fn);

    return index === -1 ? null : index;
  }

  append(item: ObjectContainer<T>): void {
    this.array.push(item);

    this.items_changed(this.array.length - 1, 0, 1);
  }

  remove(item: number): void {
    this.array.splice(item, 1);

    this.items_changed(item, 1, 0);
  }

  insert(position: number, item: ObjectContainer<T>): void {
    this.array.splice(position, 0, item);

    this.items_changed(position, 0, 1);
  }

  foreach(fn: (item: ObjectContainer<T>, n: number) => void) {
    this.array.forEach(fn);
  }

  splice(position: number, removed: number, added: ObjectContainer<T>[]): void {
    this.array.splice(position, removed, ...added);

    this.items_changed(position, removed, added.length);
  }

  remove_all(): void {
    const length = this.array.length;

    this.array.splice(0, length);

    this.items_changed(0, length, 0);
  }

  remove_all_unpinned(): void {
    const length = this.array.length;

    this.array = this.array.filter((item) => {
      return item.object.pinned;
    });

    this.items_changed(0, length, length);
  }

  vfunc_get_section(position: number) {
    const first_index =
      position === 0
        ? 0
        : this.array.findLastIndex((container, index) => {
            return index <= position && container.object.title;
          });
    const last_index = this.array.findIndex((container, index) => {
      return index > position && container.object.title;
    });

    if (first_index < 0) {
      return [this.array.length, GLib.MAXUINT32];
    }

    if (last_index < 0) {
      return [first_index, this.array.length];
    }

    return [first_index, last_index];
  }

  get get_section() {
    return this.vfunc_get_section;
  }
}

function isValidMuzikaURI(uri: string) {
  try {
    const url = new URL(uri);
    // accept muzika:id but not muzika://id
    return url.protocol === "muzika:" && uri.at(6) !== "/";
  } catch {
    return false;
  }
}
