import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import type { SearchContent, TopResult } from "libmuse";

import { TopResultCard } from "./topresultcard.js";
import { FlatListView } from "../carousel/view/flatlist.js";
import { PlayableContainer } from "src/util/playablelist.js";

GObject.type_ensure(TopResultCard.$gtype);

export class TopResultSection extends Gtk.Box {
  static {
    GObject.registerClass(
      {
        GTypeName: "TopResultSection",
        Template:
          "resource:///com/vixalien/muzika/ui/components/search/topresultsection.ui",
        InternalChildren: ["box", "card", "list_view"],
      },
      this,
    );
  }

  private _box!: Gtk.Box;
  private _card!: TopResultCard;
  private _list_view!: FlatListView;

  breakpoint: Adw.Breakpoint;

  constructor(breakpoint: Adw.Breakpoint) {
    super();

    this.breakpoint = breakpoint;

    this.breakpoint.connect("apply", () => {
      this.breakpoint_applied = true;
      this.update_breakpoint();
    });

    this.breakpoint.connect("unapply", () => {
      this.breakpoint_applied = false;
      this.update_breakpoint();
    });

    this._list_view.connect("activate", this.row_activated.bind(this));
  }

  show_top_result(top_result: TopResult) {
    this._card.show_top_result(top_result);

    if (top_result.more && top_result.more.length > 0) {
      this._list_view.visible = true;
      this._list_view.items.splice(
        0,
        0,
        top_result.more.map(PlayableContainer.new_from_search_content),
      );
    } else {
      this._list_view.visible = false;
    }

    this.update_breakpoint();
  }

  row_activated(source: FlatListView, position: number) {
    const content = source.items.get_item(position)?.object as SearchContent;

    if (!content) return;

    let uri: string | null = null;

    switch (content.type) {
      case "playlist":
        uri = `playlist:${content.browseId}`;
        break;
      case "artist":
        uri = `artist:${content.browseId}`;
        break;
      case "album":
        uri = `album:${content.browseId}`;
        break;
      case "radio":
        // row.dynamic_image.state = DynamicActionState.LOADING;
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${content.playlistId}?video=${content.videoId}`,
          ),
        );
        break;
      case "song":
      case "video":
        // row.dynamic_image.state = DynamicActionState.LOADING;
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

  private breakpoint_applied = false;

  private update_breakpoint() {
    if (this.breakpoint_applied) {
      this._box.orientation = Gtk.Orientation.VERTICAL;
      this._card.small_layout();
    } else {
      this._box.orientation = Gtk.Orientation.HORIZONTAL;
      this._card.large_layout();
    }
  }
}
