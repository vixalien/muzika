import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { MiniPlayerView } from "./mini.js";
import { FullPlayerView } from "./full.js";
import { MuzikaPlayer } from "src/player";

export interface PlayerViewOptions {
  player: MuzikaPlayer;
}

export class PlayerView extends Gtk.Revealer {
  static {
    GObject.registerClass({
      GTypeName: "PlayerView",
    }, this);
  }

  player: MuzikaPlayer;

  squeezer: Adw.Squeezer;
  mini: MiniPlayerView;
  full: FullPlayerView;

  constructor(options: PlayerViewOptions) {
    super();

    this.player = options.player;

    this.squeezer = new Adw.Squeezer({
      homogeneous: false,
      interpolate_size: true,
      transition_type: Adw.SqueezerTransitionType.CROSSFADE,
    });

    this.full = new FullPlayerView(options);
    this.mini = new MiniPlayerView(options);

    this.squeezer.add(this.full);
    this.squeezer.add(this.mini);

    this.set_child(this.squeezer);

    options.player.queue.connect(
      "notify::current",
      this.song_changed.bind(this),
    );

    // resume player animation when the child changes
    // this.squeezer.connect("notify::visible-child", () => {
    //   const position = options.player.timestamp;

    //   this.mini.progress_bar.update_position(position);
    //   this.full.scale.update_position(position);

    // });
  }

  song_changed() {
    this.reveal_child = this.player.queue.current?.object != null;
  }
}
