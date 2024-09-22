import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { Paginator } from "../components/paginator.js";

import { get_home } from "libmuse";
import type { Home, MixedContent, Mood } from "libmuse";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";
import { add_toast } from "src/util/window.js";

GObject.type_ensure(Loading.$gtype);
GObject.type_ensure(Paginator.$gtype);

export interface HomePageState extends VScrollState {
  home: Home;
}

export class HomePage
  extends Adw.Bin
  implements MuzikaPageWidget<Home, HomePageState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "HomePage",
        Template: "resource:///com/vixalien/muzika/ui/pages/home.ui",
        InternalChildren: [
          "scrolled",
          "box",
          "paginator",
          "carousels",
          "moods",
        ],
      },
      this,
    );
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;
  private _paginator!: Paginator;
  private _carousels!: Gtk.Box;
  /// @ts-expect-error outdated types
  private _moods!: Adw.ToggleGroup;

  home?: Home;

  constructor() {
    super();

    this._scrolled.vadjustment.connect("value-changed", () => {
      if (this.check_if_almost_scrolled() && !this.had_error_loading) {
        this.load_more();
      }
    });

    this._paginator.connect("activate", () => {
      this.load_more();
    });
  }

  static load(ctx: PageLoadContext) {
    return get_home({
      limit: 3,
      signal: ctx.signal,
      params: ctx.url.searchParams.get("params") || undefined,
    });
  }

  present(home: Home): void {
    this.loading = false;
    this._paginator.can_paginate = home.continuation != null;

    this.home = home;

    this.append_contents(home.results);
    this.show_moods(home.moods);

    // this.check_height_and_load();
  }

  get_state() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      home: this.home!,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: HomePageState) {
    this.present(state.home);

    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
  }

  clear() {
    let child = this._box.get_first_child();

    while (child) {
      if (child instanceof Paginator) {
        child = child.get_next_sibling();
        continue;
      }

      const current = child;
      child = child.get_next_sibling();
      this._box.remove(current);
    }

    return;
  }

  private append_contents(result: MixedContent[]) {
    for (const content of result) {
      const carousel = new Carousel();

      carousel.show_content(content);
      this._carousels.append(carousel);
    }
  }

  private show_moods(moods: Mood[]) {
    if (!moods || moods.length === null) {
      this._moods.visible = false;
      return;
    }

    this._moods.visible = true;

    for (const mood of moods) {
      /// @ts-expect-error outdated types
      const toggle = new Adw.Toggle({
        name: mood.params,
        label: mood.name,
      });

      this._moods.add(toggle);
    }

    this._moods.active_name = this.get_active_mood_param();
  }

  private get_active_mood_param() {
    return (
      this.home?.moods.find((mood) => mood.selected === true)?.params ?? "home"
    );
  }

  private on_mood_changed_cb() {
    const param = this._moods.active_name;

    if (param === this.get_active_mood_param()) return;

    console.log("navigating");

    this.activate_action(
      "navigator.replace",
      GLib.Variant.new_string(
        param === "home" ? "muzika:home" : `muzika:home?params=${param}`,
      ),
    );
  }

  check_if_almost_scrolled() {
    const vadjustment = this._scrolled.get_vadjustment();

    if (
      vadjustment.get_upper() -
        (vadjustment.get_value() + vadjustment.get_page_size()) <
      300
    ) {
      return true;
    }

    return false;
  }

  private had_error_loading = false;

  check_height_and_load() {
    if (this._paginator.loading || this.had_error_loading) return;

    // scroll if the scrolled window is not full
    if (
      this._scrolled.get_vadjustment().get_upper() -
        this._scrolled.get_vadjustment().get_page_size() <
      0
    ) {
      this.load_more();
    }

    // scroll if the scrolled window is almost full
  }

  get loading() {
    return this._paginator.loading;
  }

  set loading(value: boolean) {
    this._paginator.loading = value;
  }

  load_more() {
    if (this.loading) return;

    this.loading = true;

    if (this.home?.continuation) {
      return get_home({ continuation: this.home.continuation })
        .then((updated) => {
          if (!this.home) return;

          this.home.continuation = updated.continuation;
          this.home.results.push(...updated.results);

          this._paginator.can_paginate = updated.continuation != null;
          this.had_error_loading = false;

          this.append_contents(updated.results);

          this.check_height_and_load();
        })
        .catch(() => {
          add_toast(
            _(
              "Couldn't get more items from your home feed. Please try again later.",
            ),
          );

          this._paginator.can_paginate = !!this.home?.continuation;
          this.had_error_loading = true;
        })
        .finally(() => {
          this.loading = false;
        });
    } else {
      this.loading = false;
      this._paginator.can_paginate = false;
    }
  }
}
