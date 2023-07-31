import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_player } from "src/application";
import "./mini";

export class VideoPlayerView extends Adw.Bin {
  static {
    GObject.registerClass({
      GTypeName: "VideoPlayerView",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/video/view.ui",
      InternalChildren: [
        "picture",
        "fullscreen",
        "toolbar_view",
        "window_title",
      ],
    }, this);
  }

  private _picture!: Gtk.Picture;
  private _fullscreen!: Gtk.Button;
  private _toolbar_view!: Adw.ToolbarView;
  private _window_title!: Adw.WindowTitle;

  constructor() {
    super();

    const player = get_player();

    player.connect("notify::paintable", () => {
      this._picture.set_paintable(player.paintable);
    });

    this._picture.set_paintable(player.paintable);

    // player

    player.connect("notify::now-playing", () => {
      this.song_changed();
    });

    this.song_changed();

    // hover
    const hover = new Gtk.EventControllerMotion();
    hover.connect("enter", () => {
      this.show_ui(true);
    });
    hover.connect("motion", () => {
      this.show_ui(true);
    });
    hover.connect("leave", () => {
      this.show_ui(false);
    });

    // click
    const click = new Gtk.GestureClick();
    click.connect("released", (_, n) => {
      if (n == 1) {
        this.activate_action("player.play-pause", null);
      } else if (n == 2) {
        this.activate_action("player.play-pause", null);
        this.on_fullscreen_clicked();
      }
    });
    click.propagation_phase = Gtk.PropagationPhase.TARGET;

    this._toolbar_view.add_controller(hover);
    this._toolbar_view.add_controller(click);
  }

  private song_changed() {
    const player = get_player();

    const track = player.now_playing?.object.song;

    if (track) {
      this._window_title.title = track.videoDetails.title;
      this._window_title.subtitle = track.videoDetails.author;
    }
  }

  rooted = false;

  vfunc_root(): void {
    if (this.rooted) {
      super.vfunc_root();
      return;
    }

    const window = this.get_root() as Gtk.Window;

    window.connect("notify::fullscreened", () => {
      this._fullscreen.set_icon_name(
        window.fullscreened
          ? "view-restore-symbolic"
          : "view-fullscreen-symbolic",
      );
    });

    super.vfunc_root();
  }

  private on_fullscreen_clicked(): void {
    const window = this.get_root() as Gtk.Window;

    if (!window) return;

    window.fullscreened = !window.fullscreened;
  }

  show_ui(show: boolean) {
    if (show === false) {
      return GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
        this._toolbar_view.reveal_top_bars =
          this._toolbar_view.reveal_bottom_bars =
            false;
        return false;
      });
    }

    this._toolbar_view.reveal_top_bars =
      this._toolbar_view.reveal_bottom_bars =
        show;
  }
}
