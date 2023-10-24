import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { PlayerProgressBar } from "./progress.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { MuzikaPlayer } from "src/player";
import { SignalListeners } from "src/util/signal-listener.js";
import { get_player } from "src/application.js";
import { bind_play_icon } from "src/player/helpers.js";

export class MiniPlayerView extends Gtk.Overlay {
  static {
    GObject.registerClass({
      GTypeName: "MiniPlayerView",
      Template: "resource:///com/vixalien/muzika/ui/components/player/mini.ui",
      InternalChildren: [
        "title",
        "subtitle",
        "play_button",
      ],
    }, this);
  }

  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _play_button!: Gtk.Button;

  player: MuzikaPlayer;

  progress_bar: PlayerProgressBar;

  constructor() {
    super();

    this.player = get_player();

    this.progress_bar = new PlayerProgressBar();
    this.add_overlay(this.progress_bar);
  }

  song_changed() {
    this.progress_bar.value = this.player.timestamp;

    const song = this.player.queue.current?.object;
    if (song) {
      this.show_song(song!);
    }
  }

  private listeners = new SignalListeners();

  setup_player() {
    this.song_changed();

    // update the player when the current song changes
    this.listeners.connect(
      this.player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.listeners.add_bindings(
      bind_play_icon(this._play_button),
    );

    this.listeners.connect(this.player, "notify::duration", () => {
      this.progress_bar.set_duration(this.player.duration);
    });

    this.progress_bar.set_duration(this.player.duration);

    this.listeners.connect(this.player, "notify::timestamp", () => {
      this.progress_bar.update_position(this.player.timestamp);
    });

    this.progress_bar.update_position(this.player.timestamp);
  }

  show_song(track: QueueTrack) {
    this._title.label = track.title;
    this._subtitle.label = track.artists[0].name;
  }

  vfunc_map(): void {
    this.listeners.clear();
    this.setup_player();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
