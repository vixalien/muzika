import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { get_history, History, PlaylistItem } from "../../muse.js";

import { PlaylistItemCard } from "src/components/playlist/item.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";

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

export class HistoryPage extends Gtk.Box
  implements MuzikaComponent<History, HistoryState> {
  static {
    GObject.registerClass({
      GTypeName: "HistoryPage",
      Template:
        "resource:///com/vixalien/muzika/ui/components/library/history.ui",
      InternalChildren: ["list"],
    }, this);
  }

  private _list!: Gtk.ListBox;

  results?: History;

  constructor() {
    super();

    this._list.set_header_func((row) => {
      const card = row as PlaylistItemCard;
      const item = card.item as PlaylistItemWithCategory;
      const category = item?.category;

      if (category) {
        const title = new HistoryTitle({ title: category });

        row.set_header(title);
      }
    });
  }

  loading = false;

  present(history: History) {
    this.results = history;

    this.show_library(history);
  }

  private show_library(library: History) {
    library.categories.forEach((category) => {
      category.items
        .filter(Boolean)
        .forEach((item, index) => {
          if (index === 0) {
            item = {
              ...item,
              category: category.title,
            } as PlaylistItemWithCategory;
          }

          const card = new PlaylistItemCard();

          card.set_item(item);

          this._list.append(card);
        });
    });
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
