import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_song_related } from "src/muse";
import { Carousel } from "../carousel";
import { MuzikaPlayer } from "src/player";
import { get_player } from "src/application";

export interface RelatedViewOptions {
  player: MuzikaPlayer;
}

export class RelatedView extends Gtk.Stack {
  static {
    GObject.registerClass({
      GTypeName: "RelatedView",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/related.ui",
      InternalChildren: [
        "no_related",
        "loading",
        "related_window",
        "box",
      ],
    }, this);
  }

  _no_lyrics!: Adw.StatusPage;
  _loading!: Gtk.Spinner;
  _related_window!: Gtk.ScrolledWindow;
  _box!: Gtk.Box;

  player: MuzikaPlayer;

  constructor() {
    super({
      vhomogeneous: false,
    });

    this.player = get_player();
  }

  related: string | null = null;
  loaded = false;
  controller: AbortController | null = null;

  async load_related() {
    const new_related = this.player.queue.settings?.related ?? null;

    if (new_related !== this.related) {
      this.related = new_related;
      this.loaded = false;
    }

    if (this.controller) {
      this.controller.abort();
    }

    if (this.loaded) {
      return;
    }

    this.controller = new AbortController();

    if (this.related) {
      this.set_visible_child(this._loading);
      this._loading.start();

      await get_song_related(this.related, {
        signal: this.controller.signal,
      }).then((result) => {
        let child: Gtk.Widget | null = null;

        while (child = this._box.get_first_child()) {
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

        this.loaded = true;

        this.set_visible_child(this._related_window);
      }).catch((err) => {
        if (err.name === "AbortError") {
          return;
        } else {
          throw err;
        }
      }).finally(() => {
        this._loading.stop();
      });
    } else {
      this.loaded = true;
      this.set_visible_child(this._no_lyrics);
    }
  }
}
