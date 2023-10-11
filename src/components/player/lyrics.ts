import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_lyrics, Lyrics, TimedLyrics } from "src/muse";
import { escape_label } from "src/util/text";
import { MuzikaPlayer } from "src/player";
import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";

type LyricLine = TimedLyrics["timed_lyrics"][number];

export class TimedLyricLineRow extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "TimedLyricLineRow",
    }, this);
  }

  line: LyricLine;

  constructor(line: LyricLine) {
    super({
      child: new Gtk.Label({
        label: line.line,
        wrap: true,
        xalign: 0,
      }),
      css_classes: ["lyrics-line"],
    });

    this.line = line;
  }
}

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
        "timed_window",
        "timed_listbox",
        "timed_source",
      ],
    }, this);
  }

  private _no_lyrics!: Adw.StatusPage;
  private _loading!: Gtk.Spinner;
  private _lyrics_window!: Gtk.ScrolledWindow;
  private _view!: Gtk.TextView;
  private _buffer!: Gtk.TextBuffer;
  private _timed_window!: Gtk.ScrolledWindow;
  private _timed_listbox!: Gtk.ListBox;
  private _timed_source!: Gtk.Label;

  player: MuzikaPlayer;

  constructor() {
    super({
      vhomogeneous: false,
    });

    this.player = get_player();

    this._view.remove_css_class("view");
  }

  lyrics_browseId: string | null = null;
  loaded = false;
  controller: AbortController | null = null;

  async load_lyrics() {
    const new_lyrics = this.player.queue.settings?.lyrics ?? null;

    if (new_lyrics !== this.lyrics_browseId) {
      this.lyrics_browseId = new_lyrics;
      this.loaded = false;
    }

    if (this.controller) {
      this.controller.abort();
    }

    if (this.loaded) {
      return;
    }

    this.controller = new AbortController();

    if (this.lyrics_browseId) {
      this.set_visible_child(this._loading);
      this._loading.start();

      await get_lyrics(this.lyrics_browseId, {
        signal: this.controller.signal,
      }).then((lyrics) => {
        this.show_lyrics(lyrics);

        this.loaded = true;
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

  clear_views() {
    this._buffer.text = "";

    let child = this._timed_listbox.get_first_child();

    while (child) {
      this._timed_listbox.remove(child);

      child = this._timed_listbox.get_first_child();
    }
  }

  private lyrics: Lyrics | null = null;

  show_lyrics(lyrics: Lyrics) {
    this.lyrics = lyrics;
    this.clear_views();

    if (
      lyrics.timed && Gtk.Settings.get_default()!.gtk_enable_animations === true
    ) {
      lyrics.timed_lyrics.forEach((line) => {
        const row = new TimedLyricLineRow(line);

        this._timed_listbox.append(row);
      });

      this._timed_source.label = lyrics.source;

      this.set_visible_child(this._timed_window);
    } else {
      this._buffer.text = lyrics.lyrics;

      this._buffer.insert_markup(
        this._buffer.get_end_iter(),
        `\n\n<i>${escape_label(lyrics.source)}</i>`,
        -1,
      );

      this.set_visible_child(this._lyrics_window);
    }
  }

  private pending_animation: Adw.Animation | null = null;

  private scroll_to_row(
    _: Gtk.ListBox,
    row: Gtk.ListBoxRow,
    force = false,
  ) {
    if (((this.get_state_flags() & Gtk.StateFlags.ACTIVE) !== 0) && !force) {
      return;
    }

    if (this.pending_animation) {
      this.pending_animation.pause();
      this.pending_animation.unref();

      this.pending_animation = null;
    }

    const [success, rect] = row.compute_bounds(this._timed_listbox);

    if (success) {
      const scroll_to = rect.get_y() - 180;

      // don't scroll if the scroll value is near the target (in one direction)
      if (
        Math.abs(scroll_to - this._timed_window.vadjustment.value) < 40
      ) {
        return;
      }

      const property_target = Adw.PropertyAnimationTarget.new(
        this._timed_window.vadjustment,
        "value",
      );

      const animation = Adw.TimedAnimation.new(
        this._timed_window,
        this._timed_window.vadjustment.value,
        Math.min(Math.max(scroll_to, 0), this._timed_window.vadjustment.upper),
        500,
        property_target,
      );

      animation.connect("done", () => {
        this.pending_animation = null;
      });

      animation.play();

      this.pending_animation = animation;
    }
  }

  private lyrics_row_activated(
    _: Gtk.ListBox,
    row: TimedLyricLineRow,
  ) {
    const player = get_player();

    player.seek(row.line.start * 1000 + 1);

    this.scroll_to_row(this._timed_listbox, row, true);
  }

  private listeners = new SignalListeners();

  private setup_timed_lyrics() {
    // add some padding to the bottom
    this.listeners.connect(
      get_player(),
      "notify::timestamp",
      this.on_timestamp.bind(this),
    );

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      this.on_timestamp();

      return GLib.SOURCE_REMOVE;
    });
  }

  private on_timestamp() {
    const player = get_player();

    if (!this.lyrics?.timed) {
      return;
    }

    const line_id = this.lyrics.timed_lyrics.findIndex((line) => {
      const timestamp_milli = player.timestamp / 1000;
      return timestamp_milli >= line.start && timestamp_milli <= line.end;
    });

    if (line_id < 0) {
      this._timed_listbox.unselect_all();
      return;
    }

    const row = this._timed_listbox.get_row_at_index(line_id);

    if (row && row !== this._timed_listbox.get_selected_row()) {
      this._timed_listbox.select_row(row);

      this.scroll_to_row(this._timed_listbox, row);
    }
  }

  private clear() {
    this.listeners.clear();
  }
}
