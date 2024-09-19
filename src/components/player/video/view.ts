import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_player } from "src/application";
import { VideoControls } from "./controls";
import { load_thumbnails } from "src/components/webimage";
import { SignalListeners } from "src/util/signal-listener";
import { isEqual } from "lodash-es";

GObject.type_ensure(VideoControls.$gtype);

export class VideoPlayerView extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "VideoPlayerView",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/video/view.ui",
        InternalChildren: [
          "picture",
          "button_fullscreen",
          "controls",
          "toolbar_revealer",
          "motion",
        ],
        Properties: {
          bottom_bar_height: GObject.ParamSpec.uint(
            "bottom-bar-height",
            "Bottom Bar Height",
            "The height of the video player controls",
            GObject.ParamFlags.READWRITE,
            0,
            GLib.MAXUINT32,
            0,
          ),
        },
      },
      this,
    );
  }

  private _picture!: Gtk.Picture;
  private _button_fullscreen!: Gtk.Button;
  private _controls!: VideoControls;
  private _toolbar_revealer!: Gtk.Revealer;
  private _motion!: Gtk.EventControllerMotion;

  vfunc_root(): void {
    super.vfunc_root();

    const window = this.root as Gtk.Window;

    // @ts-expect-error incorrect types
    window.bind_property_full(
      "fullscreened",
      this._button_fullscreen,
      "icon-name",
      GObject.BindingFlags.SYNC_CREATE,
      (_, from) => {
        return [
          true,
          from ? "view-restore-symbolic" : "view-fullscreen-symbolic",
        ];
      },
      null,
    );
  }

  private hide_revealers() {
    // checks
    if (this._controls.inhibit_hide) return;

    // if (this._motion.contains_pointer) return;

    // actions

    this._toolbar_revealer.reveal_child = false;

    this.set_cursor_from_name("none");
  }

  private last_timeout: null | number = null;

  private show_revealers() {
    this._toolbar_revealer.reveal_child = true;

    this.set_cursor_from_name(null);

    if (this.last_timeout !== null) {
      GLib.source_remove(this.last_timeout);
    }

    this.last_timeout = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      2,
      () => {
        this.hide_revealers();

        this.last_timeout = null;
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  private load_controller: AbortController | null = null;
  private last_id = "";

  private async load_thumbnails() {
    this.load_controller?.abort();
    this.load_controller = new AbortController();

    const current = get_player().queue.current?.object;

    if (!current) return;
    if (current.videoId == this.last_id) return;

    await load_thumbnails(this._picture, current.thumbnails, {
      width: 1000,
      upscale: true,
      signal: this.load_controller.signal,
    })
      .then(() => {
        this.last_id = current.videoId;
      })
      .catch(() => {
        // do nothing
      });
  }

  private update_paintable() {
    const player = get_player();

    this.load_controller?.abort();
    this.load_controller = null;

    if (
      player.media_info &&
      player.media_info.get_number_of_video_streams() > 0
    ) {
      this._picture.paintable = player.paintable;
      return;
    }

    this.load_thumbnails();
  }

  private listeners = new SignalListeners();

  private last_coords = [0, 0];

  private on_motion_cb(
    _: Gtk.EventControllerMotion,
    ...coords: [number, number]
  ) {
    if (isEqual(coords, this.last_coords)) return;
    this.last_coords = coords;

    this.show_revealers();
  }

  private on_primary_click_released_cb(gesture: Gtk.GestureClick, n: number) {
    this.show_revealers();
    gesture.set_state(Gtk.EventSequenceState.CLAIMED);

    if (
      gesture.get_current_event()?.get_device()?.source ===
      Gdk.InputSource.TOUCHSCREEN
    )
      return;

    get_player().play_pause();

    if (n % 2 === 0) {
      this.activate_action("win.fullscreen", null);
    }
  }

  private key_pressed_cb(_controller: Gtk.EventControllerKey, keyval: number) {
    const player = get_player();

    if (keyval === Gdk.KEY_space || keyval === Gdk.KEY_p) {
      player.play_pause();
    } else if (keyval === Gdk.KEY_Left) {
      player.skip_seconds(-10);
    } else if (keyval === Gdk.KEY_Right) {
      player.skip_seconds(10);
    } else if (keyval === Gdk.KEY_n) {
      player.queue.next();
    } else if (keyval === Gdk.KEY_b) {
      player.queue.previous();
    } else if (keyval === Gdk.KEY_plus) {
      player.cubic_volume += 0.1;
    } else if (keyval === Gdk.KEY_minus) {
      player.cubic_volume -= 0.1;
    } else if (keyval === Gdk.KEY_f) {
      this.activate_action("win.fullscreen", null);
    } else {
      return Gdk.EVENT_PROPAGATE;
    }

    return Gdk.EVENT_STOP;
  }

  vfunc_map() {
    super.vfunc_map();

    const player = get_player();

    this.listeners.connect(
      player,
      "notify::media-info",
      this.update_paintable.bind(this),
    );

    this.update_paintable();

    // // fix everytime cursor is inside the window, the ui will be shown
    // const last_motion = [0, 0] as [number, number];
    // this.listeners.add(this.hover, [
    //   this.hover.connect("enter", this.extend_ui_visible_time.bind(this)),

    //   this.hover.connect("motion", (_, x, y) => {
    //     if (x == last_motion[0] && y == last_motion[1]) return;
    //     last_motion[0] = x;
    //     last_motion[1] = y;
    //     this.extend_ui_visible_time();
    //   }),

    //   this.hover.connect("leave", this.extend_ui_visible_time.bind(this)),
    // ]);
  }

  vfunc_unmap() {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
