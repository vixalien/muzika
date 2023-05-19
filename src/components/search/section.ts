import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import {
  filters,
  search,
  SearchContent,
  SearchOptions,
  SearchResults,
} from "../../muse.js";
import { InlineCard } from "./inlinecard.js";
import { search_args_to_url } from "../../pages/search.js";

export class SearchSection extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SearchSection",
      Template: "resource:///com/vixalien/muzika/components/search/section.ui",
      InternalChildren: ["title", "more", "content"],
    }, this);
  }

  _title!: Gtk.Label;
  _more!: Gtk.Button;
  _content!: Gtk.ListBox;

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

    this._content.connect("row-activated", this.row_activated.bind(this));
  }

  row_activated(_: this, row: InlineCard) {
    if (!row.content) return;

    let uri: string | null = null;

    switch (row.content.type) {
      case "playlist":
        uri = `playlist:${row.content.browseId}`;
        break;
      case "artist":
        uri = `artist:${row.content.browseId}`;
        break;
      case "album":
        uri = `album:${row.content.browseId}`;
        break;
      case "radio":
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${row.content.playlistId}?video=${row.content.videoId}`,
          ),
        );
        break;
      case "song":
      case "video":
        this.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(
            row.content.videoId,
          ),
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

  add_content(content: SearchContent) {
    let card = new InlineCard();

    if (!this.show_type) card.show_type(false);

    switch (content.type) {
      case "song":
        card.set_song(content);
        break;
      case "video":
        card.set_video(content);
        break;
      case "album":
        card.set_album(content);
        break;
      case "artist":
        card.set_artist(content);
        break;
      case "playlist":
        card.set_playlist(content);
        break;
      default:
        console.error("Unknown search content type", content.type);
        return;
    }

    this._content.append(card);
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

    category.results.forEach((result) => {
      this.add_content(result);
    });
  }
}
