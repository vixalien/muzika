import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { get_history, History, PlaylistItem } from "../../muse.js";

import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";

interface HistoryTitleOptions {
  title?: string;
}

interface HistoryState {
  results: History;
}

class HistoryTitle extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "HistoryTitle",
    }, this);
  }
  constructor(props: HistoryTitleOptions = {}) {
    super({
      margin_top: 12,
      margin_bottom: 12,
    });

    const label = new Gtk.Label({
      label: props.title ?? undefined,
      hexpand: true,
      xalign: 0,
    });

    label.add_css_class("title-1");

    this.append(label);
  }
}

interface CategoryMeta {
  title: string;
}

export class HistoryPage extends Adw.Bin
  implements MuzikaComponent<History, HistoryState> {
  static {
    GObject.registerClass({
      GTypeName: "HistoryPage",
      Template:
        "resource:///com/vixalien/muzika/ui/components/library/history.ui",
      InternalChildren: ["item_view"],
    }, this);
  }

  private _item_view!: PlaylistItemView;

  results?: History;

  model = new PlayableList<PlaylistItem>();

  constructor() {
    super();

    this._item_view.model = this.model;

    // TODO: see https://gitlab.gnome.org/GNOME/gjs/-/issues/570
    // const factory = new Gtk.SignalListItemFactory();
    // factory.connect("setup", this._header_setup_cb.bind(this));
    // factory.connect("bind", this._header_bind_cb.bind(this));

    // this._item_view.header_factory s= factory;
  }

  private _header_setup_cb(
    _factory: Gtk.SignalListItemFactory,
    List_item: Gtk.ListItem,
  ) {
    const title = new HistoryTitle();
    List_item.set_child(title);
  }

  private _header_bind_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListHeader,
  ) {
    const card = list_item.child as HistoryTitle;
    const container = list_item.item;
  }

  loading = false;

  present(history: History) {
    this.results = history;

    this.show_library(history);
  }

  private show_library(library: History) {
    const items = library.categories.reduce((acc, category) => {
      return acc.concat(category.items.map((item, index) => {
        return PlayableContainer.new_from_playlist_item(item);
      }));
    }, [] as PlayableContainer[]);

    this.model.splice(
      this.model.n_items,
      0,
      items,
    );
  }

  get_state() {
    return {
      results: this.results!,
    };
  }

  restore_state(state: HistoryState) {
    this.present(state.results);
  }

  static load(context: EndpointContext) {
    return get_history();
  }
}
