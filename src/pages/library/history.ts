import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { get_history, History, PlaylistItem } from "../../muse.js";

import { PlaylistItemCard } from "src/components/playlist/item.js";

interface PlaylistItemWithCategory extends PlaylistItem {
  category?: string;
}

interface HistoryTitleOptions {
  title: string;
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

export class HistoryPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "HistoryPage",
      Template: "resource:///com/vixalien/muzika/ui/components/library/history.ui",
      InternalChildren: ["list"],
    }, this);
  }

  private _list!: Gtk.ListBox;

  loader = get_history;
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

  show_library(library: History) {
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

  async load_library() {
    this.results = await this.loader();

    this.show_library(this.results);
  }
}
