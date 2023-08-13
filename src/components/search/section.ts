import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { filters, search, SearchContent, SearchResults } from "../../muse.js";
import { search_args_to_url } from "../../pages/search.js";
import { FlatListView } from "../carousel/view/flatlist.js";
import { PlayableContainer } from "src/util/playablelist.js";

FlatListView;

export class SearchSection extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SearchSection",
      Template:
        "resource:///com/vixalien/muzika/ui/components/search/section.ui",
      InternalChildren: ["title", "more", "card_view"],
    }, this);
  }

  private _title!: Gtk.Label;
  private _more!: Gtk.Button;
  private _card_view!: FlatListView;

  args: Parameters<typeof search>;
  show_more: boolean;
  show_type: boolean;

  constructor(
    options: {
      args: Parameters<typeof search>;
      show_more?: boolean;
      show_type?: boolean;
    },
  ) {
    super();

    this.args = options.args;
    this.show_more = options.show_more ?? false;
    this.show_type = options.show_type ?? true;

    this._card_view.connect("activate", this.row_activated.bind(this));
  }

  row_activated(_: this, position: number) {
    const content = this._card_view.items.get_item(position)
      ?.object as SearchContent;

    if (!content) return;

    // row.dynamic_image.state = DynamicImageState.LOADING;

    let uri: string | null = null;

    switch (content.type) {
      case "playlist":
        uri = `playlist:${content.browseId}`;
        break;
      case "artist":
        uri = `artist:${content.browseId}`;
        break;
      case "profile":
        uri = `channel:${content.browseId}`;
        break;
      case "album":
        uri = `album:${content.browseId}`;
        break;
      case "radio":
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${content.playlistId}?video=${content.videoId}`,
          ),
        );
        break;
      case "song":
      case "video":
        this.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(content.videoId),
        );
        break;
    }

    if (uri) {
      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string("muzika:" + uri),
      );
    }
  }

  set_category(category: SearchResults["categories"][0]) {
    this._title.label = category.title;

    if (
      category.results.length >= 0 && this.show_more && category.filter &&
      filters.includes(category.filter)
    ) {
      const url = search_args_to_url(
        this.args[0],
        {
          filter: category.filter ?? undefined,
          ...this.args[1],
        },
      );

      this._more.visible = true;
      this._more.action_name = "navigator.visit";
      this._more.action_target = GLib.Variant.new(
        "s",
        url,
      );
    }

    this._card_view.items.splice(
      0,
      0,
      category.results.map(PlayableContainer.new_from_search_content),
    );
  }
}
