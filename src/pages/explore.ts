import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_explore } from "../muse.js";
import type {
  Category,
  ExploreContents,
  ParsedMoodOrGenre,
} from "libmuse/types/parsers/browsing.js";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { MixedCardItem } from "src/components/library/mixedcard.js";

Loading;

export interface ExplorePageState {
  contents: ExploreContents;
}

export class ExplorePage extends Adw.Bin
  implements MuzikaComponent<ExploreContents, ExplorePageState> {
  static {
    GObject.registerClass({
      GTypeName: "ExplorePage",
      Template: "resource:///com/vixalien/muzika/ui/pages/explore.ui",
      InternalChildren: ["scrolled", "box"],
    }, this);
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;

  contents?: ExploreContents;

  static load(ctx: EndpointContext) {
    return get_explore({
      signal: ctx.signal,
    });
  }

  present(explore: ExploreContents): void {
    // TODO: New albums & singles more
    this.add_carousel(_("New albums & singles"), explore.albums, false, false);
    this.add_carousel(_("Top songs"), explore.songs, true);
    this.add_mood_carousel(_("Moods and genres"), explore.moods);
    this.add_carousel(_("Trending"), explore.trending, true);

    this.contents = explore;
  }

  get_state() {
    return {
      contents: this.contents!,
    };
  }

  restore_state(state: ExplorePageState) {
    this.present(state.contents);
  }

  clear() {
    let child = this._box.get_first_child();

    while (child) {
      const current = child;
      child = child.get_next_sibling();
      this._box.remove(current);
    }

    return;
  }

  add_carousel(
    title: string,
    data: Category<MixedCardItem>,
    show_more_button = false,
    list = true,
  ) {
    if (!data || data.results.length === 0) return;

    const carousel = new Carousel();

    carousel.setup_more_button(
      (show_more_button && data.browseId != null)
        ? data.params != null
          ? `navigator.visit("muzika:artist-albums:${data.browseId}:${data.params}")`
          : `navigator.visit("muzika:playlist:${data.browseId}")`
        : null,
    );

    carousel.show_content({
      title,
      display: list ? "list" : undefined,
      contents: data.results,
    });

    this._box.append(carousel);
  }

  add_mood_carousel(title: string, data: Category<ParsedMoodOrGenre>) {
    if (!data || data.results.length === 0) return;

    const carousel = new Carousel();

    carousel.setup_more_button(`navigator.visit("muzika:moods-and-genres")`);

    carousel.show_content({
      title,
      display: "mood",
      contents: data.results as any,
    });

    this._box.append(carousel);
  }
}
