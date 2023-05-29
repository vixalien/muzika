import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { Paginator } from "../components/paginator.js";

import { get_home, Home, MixedContent } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";

export class HomePage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "HomePage",
    }, this);
  }
  _scrolled: Gtk.ScrolledWindow;
  _clamp: Adw.Clamp;
  _box: Gtk.Box;
  _paginator: Paginator;

  home?: Home;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this._paginator = new Paginator();

    this._box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
    });

    this._box.append(this._paginator);

    this._clamp = new Adw.Clamp({
      margin_top: 12,
      margin_bottom: 12,
      maximum_size: 1000,
      tightening_threshold: 800,
    });
    this._clamp.set_child(this._box);

    this._scrolled = new Gtk.ScrolledWindow({ vexpand: true, hexpand: true });
    this._scrolled.set_child(this._clamp);

    this._scrolled.vadjustment.connect("value-changed", () => {
      if (this.check_if_almost_scrolled()) {
        this._paginator.loading = true;
        this.load_home();
      }
    });

    this._paginator.connect("activate", () => {
      this.load_home();
    });

    this.append(this._scrolled);
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
      this.load_home();
    }

    // scroll if the scrolled window is almost full
  }

  _loading = false;

  get loading() {
    return this._loading;
  }

  set loading(value: boolean) {
    this._paginator.loading = value;
    this._loading = value;
  }

  load_home(signal?: AbortSignal) {
    if (this.loading) return;

    this.loading = true;

    if (!this.home) {
      return get_home({ limit: 3, signal })
        .then((home) => {
          this.home = home;

          this.loading = false;
          this._paginator.reveal_child = home.continuation != null;

          this.append_contents(home.results);

          this.check_height_and_load();
        });
    } else if (this.home.continuation) {
      return get_home({ continuation: this.home.continuation, signal })
        .then((new_home) => {
          this.home!.continuation = new_home.continuation;
          this.home!.results.push(...new_home.results);

          this.loading = false;
          this._paginator.reveal_child = new_home.continuation != null;

          this.append_contents(new_home.results);

          this.check_height_and_load();
        });
    } else {
      this.loading = false;
      this._paginator.reveal_child = false;
    }
  }
}
