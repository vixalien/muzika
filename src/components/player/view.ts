import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { MiniPlayerView } from "./mini.js";
import { FullPlayerView } from "./full.js";
import { MuzikaPlayer } from "src/player";

export interface PlayerViewOptions {
  player: MuzikaPlayer;
}

export class PlayerView extends Adw.Bin {
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
  }
}
