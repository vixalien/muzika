import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";

import { get_history, History, PlaylistItem } from "../../muse.js";

import { PlaylistItemCard } from "src/components/playlist/item.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { InlineSongListView } from "src/components/carousel/view/inlinesonglist.js";
import { PlayableContainer } from "src/util/playablelist.js";

interface PlaylistItemWithCategory extends PlaylistItem {
  category?: string;
}

interface HistoryTitleOptions {
  title: string;
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
  constructor({ title }: HistoryTitleOptions) {
    super({
      margin_top: 12,
      margin_bottom: 12,
    });

    const label = new Gtk.Label({
      label: title,
      hexpand: true,
      xalign: 0,
    });

    label.add_css_class("title-1");

    this.append(label);
  }
}

InlineSongListView;

export class HistoryPage extends Adw.Bin
  implements MuzikaComponent<History, HistoryState> {
  static {
    GObject.registerClass({
      GTypeName: "HistoryPage",
      Template:
        "resource:///com/vixalien/muzika/ui/components/library/history.ui",
      InternalChildren: ["list_view"],
    }, this);
  }

  private _list_view!: InlineSongListView;

  results?: History;

  constructor() {
    super();

    // this._list.set_header_func((row) => {
    //   const card = row as PlaylistItemCard;
    //   const item = card.item as PlaylistItemWithCategory;
    //   const category = item?.category;

    //   if (category) {
    //     const title = new HistoryTitle({ title: category });

    //     row.set_header(title);
    //   }
    // });
  }

  loading = false;

  present(history: History) {
    this.results = history;

    this.show_library(history);
  }

  private show_library(library: History) {
    const items_with_category = library.categories.reduce(
      (acc, category) => {
        return [
          ...acc,
          ...category.items.map((item, index) => {
            if (index === 0) {
              return {
                ...item,
                category: category.title,
              } as PlaylistItemWithCategory;
            } else {
              return item;
            }
          }),
        ];
      },
      [] as PlaylistItemWithCategory[],
    );

    this._list_view.items.splice(
      0,
      0,
      items_with_category.map(PlayableContainer.new_from_playlist_item),
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
