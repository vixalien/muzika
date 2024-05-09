import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { filters, search } from "libmuse";
import type { SearchContent, SearchResults } from "libmuse";

import { search_args_to_url } from "../../pages/search.js";
import { FlatListView } from "../carousel/view/flatlist.js";
import { PlayableContainer } from "src/util/playablelist.js";

GObject.type_ensure(FlatListView.$gtype);

export class SearchSection extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "SearchSection",
        Template:
          "resource:///com/vixalien/muzika/ui/components/search/section.ui",
        InternalChildren: ["title", "more", "card_view"],
      },
      this,
    );
  }

  private _title!: Gtk.Label;
  private _more!: Gtk.Button;
  private _card_view!: FlatListView;

  args: Parameters<typeof search>;
  show_more: boolean;
  show_type: boolean;

  constructor(options: {
    args: Parameters<typeof search>;
    show_more?: boolean;
    show_type?: boolean;
  }) {
    super();

    this.args = options.args;
    this.show_more = options.show_more ?? false;
    this.show_type = options.show_type ?? true;
  }

  set_category(category: SearchResults["categories"][0]) {
    this._title.label = category.title || _("Results");

    if (
      category.results.length >= 0 &&
      this.show_more &&
      category.filter &&
      filters.includes(category.filter)
    ) {
      const url = search_args_to_url(this.args[0], {
        filter: category.filter ?? undefined,
        ...this.args[1],
      });

      this._more.visible = true;
      this._more.action_name = "navigator.visit";
      this._more.action_target = GLib.Variant.new("s", url);
    }

    this.add_search_contents(category.results);
  }

  add_search_contents(search_contents: SearchContent[]) {
    this._card_view.items.splice(
      this._card_view.items.n_items,
      0,
      search_contents.map(PlayableContainer.new_from_search_content),
    );
  }
}
