import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_lyrics } from "src/muse";
import { escape_label } from "src/util/text";
import { MuzikaPlayer } from "src/player";

export class LyricsView extends Gtk.Stack {
  static {
    GObject.registerClass({
      GTypeName: "LyricsView",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/lyrics.ui",
      InternalChildren: [
        "no_lyrics",
        "loading",
        "lyrics_window",
        "view",
        "buffer",
      ],
    }, this);
  }

  private _no_lyrics!: Adw.StatusPage;
  private _loading!: Gtk.Spinner;
  private _lyrics_window!: Gtk.ScrolledWindow;
  private _view!: Gtk.TextView;
  private _buffer!: Gtk.TextBuffer;

  player: MuzikaPlayer;

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
        this._buffer.text = lyrics.lyrics;

        this._buffer.insert_markup(
          this._buffer.get_end_iter(),
          `\n\n<i>${escape_label(lyrics.source)}</i>`,
          -1,
        );

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
  player: MuzikaPlayer;
}
