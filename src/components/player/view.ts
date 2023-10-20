import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

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

  squeezer: Adw.Squeezer;
  mini: MiniPlayerView;
  full: FullPlayerView;

  constructor() {
    super();

    this.squeezer = new Adw.Squeezer({
      homogeneous: false,
      interpolate_size: true,
      transition_type: Adw.SqueezerTransitionType.CROSSFADE,
    });

    this.full = new FullPlayerView();
    this.mini = new MiniPlayerView();

    this.squeezer.add(this.full);
    this.squeezer.add(this.mini);

    this.set_child(this.squeezer);

    const gesture = new Gtk.GestureClick({
      button: 1,
    });

    gesture.connect("pressed", this.gesture_pressed_cb.bind(this));

    this.add_controller(gesture);
  }

  private gesture_pressed_cb(gesture: Gtk.Gesture) {
    gesture.set_state(Gtk.EventSequenceState.CLAIMED);

    this.activate_action(
      "win.visible-view",
      GLib.Variant.new_string("now-playing"),
    );
  }
}
