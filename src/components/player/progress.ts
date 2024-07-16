import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";

export class PlayerProgressBar extends Gtk.ProgressBar {
  static {
    GObject.registerClass(
      {
        GTypeName: "PlayerProgressBar",
      },
      this,
    );
  }

  constructor() {
    super({
      valign: Gtk.Align.START,
    });

    this.add_css_class("osd");
  }

  private update_fraction() {
    const player = get_player();

    this.fraction =
      Math.max(
        Math.min(
          (player.initial_seek_to ?? player.timestamp) / player.duration,
          1,
        ),
        0,
      ) || 0;

    const already_buffering = this.has_css_class("buffering");

    if (player.is_buffering && player.playing) {
      if (!already_buffering) this.add_css_class("buffering");
    } else if (already_buffering) {
      this.remove_css_class("buffering");
    }
  }

  listeners = new SignalListeners();

  vfunc_map() {
    super.vfunc_map();
    this.listeners.clear();
    this.listeners.connect(
      get_player(),
      "notify::timestamp",
      this.update_fraction.bind(this),
    );
    this.listeners.connect(
      get_player(),
      "notify::duration",
      this.update_fraction.bind(this),
    );
    this.listeners.connect(
      get_player(),
      "notify::is-buffering",
      this.update_fraction.bind(this),
    );
  }

  vfunc_unmap() {
    super.vfunc_unmap();
    this.listeners.clear();
  }
}
