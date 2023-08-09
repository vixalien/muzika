import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_player } from "src/application";
import { VideoControls } from "./controls";

VideoControls;

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
        "controls",
      ],
    }, this);
  }

  private _picture!: Gtk.Picture;
  private _fullscreen!: Gtk.Button;
  private _toolbar_view!: Adw.ToolbarView;
  private _window_title!: Adw.WindowTitle;
  private _controls!: VideoControls;

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

    hover.connect("enter", this.extend_ui_visible_time.bind(this));

    // fix everytime cursor is inside the window, the ui will be shown
    const last_motion = [0, 0] as [number, number];
    hover.connect("motion", (_, x, y) => {
      if (x == last_motion[0] && y == last_motion[1]) return;
      last_motion[0] = x;
      last_motion[1] = y;
      this.extend_ui_visible_time();
    });

    hover.connect("leave", this.extend_ui_visible_time.bind(this));

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

    this.add_controller(hover);
    this._picture.add_controller(click);

    this._controls.connect("notify::inhibit-hide", () => {
      this.extend_ui_visible_time();
    });
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

  private timeout_id: number | null = null;

  private extend_ui_visible_time() {
    this.show_ui();

    if (this.timeout_id) {
      GLib.source_remove(this.timeout_id);
      this.timeout_id = null;
    }

    if (this._controls.inhibit_hide) return;

    this.timeout_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
      this.hide_ui();

      this.timeout_id = null;

      return false;
    });
  }

  private hide_ui() {
    this._toolbar_view.reveal_top_bars =
      this._toolbar_view.reveal_bottom_bars =
        false;
  }

  private show_ui() {
    this._toolbar_view.reveal_top_bars =
      this._toolbar_view.reveal_bottom_bars =
        true;
  }

  private toggle_ui() {
    this._toolbar_view.reveal_top_bars =
      this._toolbar_view.reveal_bottom_bars =
        !this._toolbar_view.reveal_top_bars;
  }
}
