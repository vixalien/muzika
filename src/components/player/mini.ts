import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { load_thumbnails } from "../webimage.js";
import { PlayerProgressBar } from "./progress.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { MuzikaPlayer } from "src/player";
import { PlayerPreview } from "./preview.js";
import { SignalListeners } from "src/util/signal-listener.js";
import { get_player } from "src/application.js";

export class MiniPlayerView extends Gtk.Overlay {
  static {
    GObject.registerClass({
      GTypeName: "MiniPlayerView",
      Template: "resource:///com/vixalien/muzika/ui/components/player/mini.ui",
      InternalChildren: [
        "player_preview",
        "title",
        "subtitle",
        "play_button",
      ],
    }, this);
  }

  private _player_preview!: PlayerPreview;
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

    this.listeners.connect(this._player_preview, "activate", () => {
      this.activate_action(
        "win.visible-view",
        GLib.Variant.new_string("video"),
      );
    });

    // update the player when the current song changes
    this.listeners.connect(
      this.player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.listeners.connect(this.player, "notify::buffering", () => {
      this.update_play_button();
    });

    this.listeners.connect(this.player, "notify::playing", () => {
      this.update_play_button();
    });

    this.update_play_button();

    this.listeners.connect(this.player, "notify::duration", () => {
      this.progress_bar.set_duration(this.player.duration);
    });

    this.progress_bar.set_duration(this.player.duration);

    this.listeners.connect(this.player, "notify::timestamp", () => {
      this.progress_bar.update_position(this.player.timestamp);
    });

    this.progress_bar.update_position(this.player.timestamp);
  }

  update_play_button() {
    this.progress_bar.buffering = this.player.is_buffering &&
      this.player.playing;

    if (this.player.playing) {
      this._play_button.icon_name = "media-playback-pause-symbolic";
    } else {
      this._play_button.icon_name = "media-playback-start-symbolic";
    }
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
