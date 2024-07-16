import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { get_history } from "libmuse";
import type { History, PlaylistItem } from "libmuse";

import { MuzikaPageWidget } from "src/navigation.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import {
  SectionedPlayableContainer,
  SectionedPlayableList,
} from "src/util/playablelist.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";

interface HistoryTitleOptions {
  title?: string;
}

interface HistoryState extends VScrollState {
  results: History;
}

class HistoryTitle extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "HistoryTitle",
      },
      this,
    );
  }

  private label_widget: Gtk.Label;

  get label() {
    return this.label_widget.label;
  }

  set label(label: string) {
    this.label_widget.label = label;
  }

  constructor(props: HistoryTitleOptions = {}) {
    super({
      margin_top: 12,
      margin_bottom: 12,
    });

    this.label_widget = new Gtk.Label({
      label: props.title ?? (null as unknown as string),
      hexpand: true,
      xalign: 0,
    });

    this.label_widget.add_css_class("title-1");

    this.append(this.label_widget);
  }
}

interface CategoryMeta {
  title: string;
}

export class HistoryPage
  extends Adw.Bin
  implements MuzikaPageWidget<History, HistoryState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "HistoryPage",
        Template:
          "resource:///com/vixalien/muzika/ui/components/library/history.ui",
        InternalChildren: ["item_view", "scrolled"],
      },
      this,
    );
  }

  private _item_view!: PlaylistItemView;
  private _scrolled!: Gtk.ScrolledWindow;

  results?: History;

  model = new SectionedPlayableList<PlaylistItem>();

  constructor() {
    super();

    this._item_view.model = Gtk.MultiSelection.new(this.model);

    // TODO: see https://gitlab.gnome.org/GNOME/gjs/-/issues/570
    const factory = new Gtk.SignalListItemFactory();
    factory.connect("setup", this._header_setup_cb.bind(this));
    factory.connect("bind", this._header_bind_cb.bind(this));

    this._item_view.header_factory = factory;
  }

  private _header_setup_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListItem,
  ) {
    const title = new HistoryTitle();
    list_item.set_child(title);
  }

  private _header_bind_cb(
    _factory: Gtk.SignalListItemFactory,
    list_item: Gtk.ListHeader,
  ) {
    const title = list_item.child as HistoryTitle;
    const container = list_item.item as SectionedPlayableContainer<
      PlaylistItem,
      CategoryMeta
    >;

    const label = container.section?.object.title;

    title.label = label ?? "";
  }

  loading = false;

  present(history: History) {
    this.results = history;

    this.show_library(history);
  }

  private show_library(library: History) {
    const items = library.categories.reduce((acc, category) => {
      return acc.concat(
        category.items.map((item, index) => {
          return SectionedPlayableContainer.new_from_playlist_item<CategoryMeta>(
            item,
            index === 0 ? { title: category.title } : undefined,
          );
        }),
      );
    }, [] as SectionedPlayableContainer[]);

    this.model.splice(this.model.n_items, 0, items);
  }

  get_state() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      results: this.results!,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: HistoryState) {
    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
    this.present(state.results);
  }

  static load() {
    return get_history();
  }
}
