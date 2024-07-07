import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_player } from "src/application";
import { VideoControls } from "./controls";
import { load_thumbnails } from "src/components/webimage";
import { SignalListeners } from "src/util/signal-listener";

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
          "fullscreen",
          "toolbar_view",
          "window_title",
          "controls",
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
  private _fullscreen!: Gtk.Button;
  private _toolbar_view!: Adw.ToolbarView;
  private _window_title!: Adw.WindowTitle;
  private _controls!: VideoControls;

  private hover = new Gtk.EventControllerMotion();
  private click = new Gtk.GestureClick({
    propagation_phase: Gtk.PropagationPhase.TARGET,
  });

  constructor() {
    super();

    this.add_controller(this.hover);
    this._picture.add_controller(this.click);
  }

  vfunc_root(): void {
    super.vfunc_root();

    const window = this.root as Gtk.Window;

    // @ts-expect-error incorrect types
    window.bind_property_full(
      "fullscreened",
      this._fullscreen,
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

  private timeout_id: number | null = null;

  private remove_timeout() {
    if (this.timeout_id) {
      GLib.source_remove(this.timeout_id);
      this.timeout_id = null;
    }
  }

  private queue_toggle_ui() {
    this.remove_timeout();

    // wait a few seconds before hiding the UI elements
    if (this._toolbar_view.reveal_top_bars) {
      this.timeout_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
        this.hide_ui();

        this.timeout_id = null;

        return false;
      });
    } else {
      this.show_ui();
    }
  }

  private extend_ui_visible_time() {
    this.show_ui();
    this.remove_timeout();

    if (this._controls.inhibit_hide) return;

    this.timeout_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
      this.hide_ui();

      this.timeout_id = null;

      return false;
    });
  }

  get ui_is_visible() {
    return this._toolbar_view.reveal_top_bars;
  }

  private hide_ui() {
    this.remove_timeout();

    if (!this.ui_is_visible) return;

    this._toolbar_view.reveal_top_bars = this._toolbar_view.reveal_bottom_bars =
      false;

    this.set_cursor(Gdk.Cursor.new_from_name("none", null));
  }

  private show_ui() {
    this.remove_timeout();

    if (this.ui_is_visible) return;

    this._toolbar_view.reveal_top_bars = this._toolbar_view.reveal_bottom_bars =
      true;

    this.set_cursor(null);
  }

  private toggle_ui() {
    this.remove_timeout();

    if (this.ui_is_visible) {
      this.hide_ui();
    } else {
      this.show_ui();
    }
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
    return;
  }

  listeners = new SignalListeners();

  vfunc_map() {
    super.vfunc_map();

    const player = get_player();

    this.listeners.connect(
      player,
      "notify::media-info",
      this.update_paintable.bind(this),
    );

    this.update_paintable();

    this.listeners.add_bindings(
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._window_title,
        "title",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          const track = player.now_playing?.object.song;

          if (!track) return [false, null];
          return [true, track.videoDetails.title];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      player.bind_property_full(
        "now-playing",
        this._window_title,
        "subtitle",
        GObject.BindingFlags.SYNC_CREATE,
        () => {
          const track = player.now_playing?.object.song;

          if (!track) return [false, null];
          return [true, track.videoDetails.author];
        },
        null,
      ),
    );

    // fix everytime cursor is inside the window, the ui will be shown
    const last_motion = [0, 0] as [number, number];
    this.listeners.add(this.hover, [
      this.hover.connect("enter", this.extend_ui_visible_time.bind(this)),

      this.hover.connect("motion", (_, x, y) => {
        if (x == last_motion[0] && y == last_motion[1]) return;
        last_motion[0] = x;
        last_motion[1] = y;
        this.extend_ui_visible_time();
      }),

      this.hover.connect("leave", this.extend_ui_visible_time.bind(this)),
    ]);

    this.listeners.add(
      this.click,
      this.click.connect("released", (click, n) => {
        if (n == 1) {
          click.set_state(Gtk.EventSequenceState.CLAIMED);
          this.queue_toggle_ui();
        } else if (n == 2) {
          click.set_state(Gtk.EventSequenceState.CLAIMED);
          this.activate_action("win.fullscreen", null);
        }
      }),
    );
  }

  vfunc_unmap() {
    this.listeners.clear();
    super.vfunc_unmap();
  }
}
