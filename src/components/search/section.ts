import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import {
  search,
  SearchContent,
  SearchOptions,
  SearchResults,
} from "../../muse.js";
import { InlineCard } from "./inlinecard.js";

function search_args_to_url(query: string, options: SearchOptions = {}) {
  const params = new URLSearchParams(Object.entries(options))
    .toString();
  let url_string = `muzika:search:${encodeURIComponent(query)}`;
  if (params) url_string += `?${params}`;

  return url_string;
}

export class SearchSection extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "SearchSection",
      Template:
        "resource:///org/example/TypescriptTemplate/components/search/section.ui",
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

    if (category.results.length >= 0) {
      const url = search_args_to_url(
        this.args[0],
        {
          filter: category.filter ?? undefined,
          ...this.args[1],
        },
      );

      if (this.show_more) {
        this._more.visible = true;
        this._more.action_name = "app.navigate";
        this._more.action_target = GLib.Variant.new(
          "s",
          url,
        );
      }
    }

    category.results.forEach((result) => {
      this.add_content(result);
    });
  }
}
