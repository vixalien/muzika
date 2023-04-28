import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { SearchContent, TopResult } from "../../muse.js";
import { InlineCard } from "./inlinecard.js";
import { TopResultCard } from "./topresultcard.js";

export class TopResultSection extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "TopResultSection",
      Template:
        "resource:///org/example/TypescriptTemplate/components/search/topresultsection.ui",
      InternalChildren: ["title", "flowbox", "content"],
    }, this);
  }

  _title!: Gtk.Label;
  _flowbox!: Gtk.FlowBox;
  _content!: Gtk.ListBox;

  constructor() {
    super();
  }

  add_more_content(content: SearchContent) {
    let card = new InlineCard();

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

  show_top_result(top_result: TopResult) {
    let card = new TopResultCard();

    switch (top_result.type) {
      case "song":
        card.set_song(top_result);
        break;
      case "album":
        card.set_album(top_result);
        break;
      case "artist":
        card.set_artist(top_result);
        break;
        // default:
        //   console.error("Unknown top result type", top_result.type);
        //   return;
    }

    if (top_result.more) {
      top_result.more.forEach(this.add_more_content.bind(this));
    }

    this._flowbox.prepend(card);
  }
}
