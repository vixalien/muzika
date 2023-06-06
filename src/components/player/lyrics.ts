import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { Player } from "src/player";
import { get_lyrics } from "libmuse";

export class LyricsView extends Gtk.Stack {
  static {
    GObject.registerClass({
      GTypeName: "LyricsView",
      Template: "resource:///com/vixalien/muzika/components/player/lyrics.ui",
      InternalChildren: [
        "no_lyrics",
        "loading",
        "lyrics_window",
        "view",
        "source",
        "buffer",
      ],
    }, this);
  }

  _no_lyrics!: Adw.StatusPage;
  _loading!: Gtk.Spinner;
  _lyrics_window!: Gtk.ScrolledWindow;
  _view!: Gtk.TextView;
  _source!: Gtk.Label;
  _buffer!: Gtk.TextBuffer;

  player: Player;

  constructor({ player }: LyricsViewOptions) {
    super({
      vhomogeneous: false,
    });

    this.player = player;

    this._view.remove_css_class("view");
  }

  lyrics: string | null = null;
  loaded = false;
  controller: AbortController | null = null;

  async load_lyrics() {
    const new_lyrics = this.player.queue.settings?.lyrics ?? null;

    if (new_lyrics !== this.lyrics) {
      this.lyrics = new_lyrics;
      this.loaded = false;
    }

    if (this.controller) {
      this.controller.abort();
    }

    if (this.loaded) {
      return;
    }

    this.controller = new AbortController();

    if (this.lyrics) {
      this.set_visible_child(this._loading);
      this._loading.start();

      await get_lyrics(this.lyrics, {
        signal: this.controller.signal,
      }).then((lyrics) => {
        this._source.label = lyrics.source;
        this._buffer.text = lyrics.lyrics;
        this.loaded = true;

        this.set_visible_child(this._lyrics_window);
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

export interface LyricsViewOptions {
  player: Player;
}
