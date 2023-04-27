import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { Loading } from "../components/loading.js";

import { get_home, Home, MixedContent } from "../muse.js";

import { Carousel } from "../components/carousel.js";

export class HomePage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "HomePage",
    }, this);
  }
  _scrolled: Gtk.ScrolledWindow;
  _clamp: Adw.Clamp;
  _box: Gtk.Box;
  _loading: Loading;

  home?: Home;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this._loading = new Loading();

    this._box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
    });

    this._box.append(this._loading);

    this._clamp = new Adw.Clamp({
      margin_top: 12,
      margin_bottom: 12,
      maximum_size: 1000,
      tightening_threshold: 800,
    });
    this._clamp.set_child(this._box);

    this._scrolled = new Gtk.ScrolledWindow({ vexpand: true, hexpand: true });
    this._scrolled.set_child(this._clamp);
    this._scrolled.connect("edge-reached", (_, pos) => {
      if (pos === Gtk.PositionType.BOTTOM) {
        this.load_home();
      }
    });

    this.append(this._scrolled);
  }

  append_contents(result: MixedContent[]) {
    for (const content of result) {
      const carousel = new Carousel();
      carousel.show_content(content);
      carousel.insert_before(this._box, this._loading);

      const spacer = new Gtk.Separator();
      spacer.add_css_class("spacer");
      spacer.insert_before(this._box, this._loading);
    }
  }

  loading = false;
  no_more = false;

  load_more() {
    if (this.loading || this.no_more) return;

    this.loading = true;

    const result = this.load_home();

    if (result) {
      result.then(() => {
        this.loading = false;
      });
    } else {
      this.loading = false;
      this.no_more = true;
    }
  }

  check_height_and_load() {
    // check if there's empty space
    // if so, load more
    let height = 0, child = this._box.get_first_child();

    while (child) {
      height += child!.get_allocated_height();
      child = child!.get_next_sibling();
    }

    if (height < this._box.get_allocated_height()) {
      this.load_more();
    }
  }

  load_home(signal?: AbortSignal) {
    if (!this.home) {
      this._loading.loading = true;

      return get_home({ limit: 3, signal })
        .then((home) => {
          this._loading.loading = false;

          this.home = home;

          this.append_contents(home.results);

          this.check_height_and_load();
        })
        .catch((e) => console.error(e.toString()));
    } else if (this.home.continuation) {
      this._loading.loading = true;

      return get_home({ continuation: this.home.continuation, signal })
        .then((new_home) => {
          this._loading.loading = false;

          this.home!.continuation = new_home.continuation;
          this.home!.results.push(...new_home.results);

          this.append_contents(new_home.results);

          this.check_height_and_load();
        })
        .catch((e) => console.error(e.toString()));
    } else {
      return null;
    }
  }
}
