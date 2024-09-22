import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_song_related } from "libmuse";

import { MuzikaPlayer } from "src/player";
import { get_player } from "src/application";
import { SignalListeners } from "src/util/signal-listener";
import { Carousel } from "src/components/carousel";

export interface RelatedViewOptions {
  player: MuzikaPlayer;
}

export class MuzikaNPRelated extends Gtk.Stack {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPRelated",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/details/related.ui",
        InternalChildren: ["no_related", "loading", "related_window", "box"],
      },
      this,
    );
  }

  private _no_related!: Adw.StatusPage;
  /// @ts-expect-error outdated types
  private _loading!: Adw.Spinner;
  private _related_window!: Gtk.ScrolledWindow;
  private _box!: Gtk.Box;

  player: MuzikaPlayer;

  constructor() {
    super({
      vhomogeneous: false,
    });

    this.player = get_player();
  }

  loaded_related: string | null = null;
  controller: AbortController | null = null;

  async load_related() {
    const new_related = this.player.now_playing?.object?.meta?.related ?? null;

    if (new_related === this.loaded_related) {
      return;
    }

    this.set_visible_child(this._loading);

    this.controller?.abort();
    this.controller = new AbortController();

    if (!new_related) {
      this.loaded_related = null;
      this.set_visible_child(this._no_related);
      return;
    }

    this.set_visible_child(this._loading);

    const result = await get_song_related(new_related, {
      signal: this.controller.signal,
    }).catch((err) => {
      if (err.name !== "AbortError") throw err;
    });

    if (!result) return;

    let child: Gtk.Widget | null = null;
    while ((child = this._box.get_first_child())) {
      this._box.remove(child);
    }

    for (const content of result) {
      const carousel = new Carousel();
      carousel.show_content(content);
      this._box.append(carousel);

      const spacer = new Gtk.Separator();
      spacer.add_css_class("spacer");
      this._box.append(spacer);
    }

    this.loaded_related = new_related;
    this.set_visible_child(this._related_window);
  }

  private listeners = new SignalListeners();

  vfunc_map(): void {
    super.vfunc_map();

    this.listeners.connect(
      this.player,
      "notify::now-playing",
      this.load_related.bind(this),
    );

    this.load_related();
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
