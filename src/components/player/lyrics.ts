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
        "lyrics_box",
        "view",
        "source",
        "buffer",
      ],
    }, this);
  }

  _no_lyrics!: Adw.StatusPage;
  _loading!: Gtk.Spinner;
  _lyrics_box!: Gtk.Box;
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

    this.player.queue.connect(
      "notify::settings",
      this.update_lyrics.bind(this),
    );
  }

  controller: AbortController | null = null;

  async update_lyrics() {
    if (this.controller) {
      this.controller.abort();
    }

    this.controller = new AbortController();

    const track_settings = this.player.queue.settings;

    if (track_settings?.lyrics) {
      this.set_visible_child(this._loading);
      this._loading.start();

      await get_lyrics(track_settings.lyrics, {
        signal: this.controller.signal,
      }).then((lyrics) => {
        this._source.label = lyrics.source;
        this._buffer.text = lyrics.lyrics;

        this.set_visible_child(this._lyrics_box);
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
      this.set_visible_child(this._no_lyrics);
    }
  }
}

export interface LyricsViewOptions {
  player: Player;
}
