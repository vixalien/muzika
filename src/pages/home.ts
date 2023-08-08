import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { Paginator } from "../components/paginator.js";

import { get_home, Home, MixedContent } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";

Loading;
Paginator;

export interface HomePageState extends VScrollState {
  home: Home;
}

export class HomePage extends Adw.Bin
  implements MuzikaComponent<Home, HomePageState> {
  static {
    GObject.registerClass({
      GTypeName: "HomePage",
      Template: "resource:///com/vixalien/muzika/ui/pages/home.ui",
      InternalChildren: ["scrolled", "box", "paginator"],
    }, this);
  }

  private _scrolled!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;
  private _paginator!: Paginator;

  home?: Home;

  constructor() {
    super();

    this._scrolled.vadjustment.connect("value-changed", () => {
      if (this.check_if_almost_scrolled()) {
        this.load_more();
      }
    });

    this._paginator.connect("activate", () => {
      this.load_more();
    });
  }

  static load(ctx: EndpointContext) {
    return get_home({ limit: 3, signal: ctx.signal });
  }

  present(home: Home): void {
    this.loading = false;
    this._paginator.can_paginate = home.continuation != null;

    this.append_contents(home.results);

    // this.check_height_and_load();

    this.home = home;
  }

  get_state() {
    return {
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

  append_contents(result: MixedContent[]) {
    for (const content of result) {
      const carousel = new Carousel();
      carousel.show_content(content);
      carousel.insert_before(this._box, this._paginator);

      const spacer = new Gtk.Separator();
      spacer.add_css_class("spacer");
      spacer.insert_before(this._box, this._paginator);
    }
  }

  check_if_almost_scrolled() {
    const vadjustment = this._scrolled.get_vadjustment();

    if (
      vadjustment.get_upper() -
          (vadjustment.get_value() + vadjustment.get_page_size()) < 300
    ) {
      return true;
    }

    return false;
  }

  check_height_and_load() {
    if (this._paginator.loading) return;

    // scroll if the scrolled window is not full
    if (
      this._scrolled.get_vadjustment().get_upper() -
          this._scrolled.get_vadjustment().get_page_size() < 0
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
          this.home!.continuation = updated.continuation;
          this.home!.results.push(...updated.results);

          this.loading = false;
          this._paginator.can_paginate = updated.continuation != null;

          this.append_contents(updated.results);

          this.check_height_and_load();
        });
    } else {
      this.loading = false;
      this._paginator.can_paginate = false;
    }
  }
}
