import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_charts } from "libmuse";
import type { Category, Charts, ParsedMoodOrGenre } from "libmuse";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import { MixedCardItem } from "src/components/library/mixedcard.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";

GObject.type_ensure(Loading.$gtype);

export interface ChartsPageState extends VScrollState {
  contents: Charts;
}

export class ChartsPage
  extends Adw.Bin
  implements MuzikaPageWidget<Charts, ChartsPageState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "ChartsPage",
        Template: "resource:///com/vixalien/muzika/ui/pages/charts.ui",
        InternalChildren: ["scrolled", "box", "drop_down"],
      },
      this,
    );
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;
  private _drop_down!: Gtk.DropDown;

  contents?: Charts;

  constructor() {
    super();

    this._drop_down.connect("notify::selected", () => {
      if (!this.contents || this._drop_down.selected < 0) return;

      const country = this.contents.countries[this._drop_down.selected];

      if (!country || country.selected) return;

      this.activate_action(
        `navigator.replace`,
        GLib.Variant.new_string(`muzika:charts?country=${country.code}`),
      );
    });
  }

  static load(ctx: PageLoadContext) {
    return get_charts(ctx.url.searchParams.get("country") ?? undefined, {
      signal: ctx.signal,
    });
  }

  present(charts: Charts): void {
    this.contents = charts;

    this._drop_down.model = Gtk.StringList.new(
      charts.countries.map((country) => country.title),
    );

    this._drop_down.selected = charts.countries.findIndex(
      (country) => country.selected,
    );

    this.add_carousel(_("Top songs"), charts.results.songs, true);
    this.add_carousel(
      _("Top music videos"),
      charts.results.videos,
      true,
      false,
    );
    // TODO: Top artists
    // this.add_carousel(_("Top artists"), charts.results.artists, true);
    this.add_carousel(_("Genres"), charts.results.genres, false, false);
    this.add_carousel(_("Trending"), charts.results.trending, true);
  }

  get_state() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      contents: this.contents!,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: ChartsPageState) {
    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
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
      show_more_button && data.browseId != null
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

  add_mood_carousel(
    title: string,
    data: Category<ParsedMoodOrGenre>,
    show_more_button = false,
  ) {
    if (!data || data.results.length === 0) return;

    const carousel = new Carousel();

    carousel.setup_more_button(
      show_more_button && data.browseId != null
        ? data.params != null
          ? `navigator.visit("muzika:artist-albums:${data.browseId}:${data.params}")`
          : `navigator.visit("muzika:playlist:${data.browseId}")`
        : null,
    );

    carousel.show_content({
      title,
      display: "mood",
      // @ts-expect-error TODO fix types
      contents: data.results,
    });

    this._box.append(carousel);
  }
}
