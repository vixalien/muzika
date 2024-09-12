import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { load_thumbnails } from "../webimage.js";
import { MuzikaPlayer } from "src/player";
import { SignalListeners } from "src/util/signal-listener.js";
import { get_player } from "src/application.js";
import { FixedRatioThumbnail } from "../fixed-ratio-thumbnail.js";

export interface MiniPlayerViewOptions {
  player: MuzikaPlayer;
}

GObject.type_ensure(FixedRatioThumbnail.$gtype);

export class PlayerPreview extends Adw.Bin {
  static {
    GObject.registerClass(
      {
        GTypeName: "PlayerPreview",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/preview.ui",
        InternalChildren: ["image"],
        Properties: {
          size: GObject.ParamSpec.int(
            "size",
            "Size",
            "Size",
            GObject.ParamFlags.READWRITE,
            0,
            GLib.MAXINT32,
            0,
          ),
        },
        Signals: {
          activate: {},
        },
      },
      this,
    );
  }

  constructor(params: Partial<Adw.Bin.ConstructorProperties>) {
    super(params);

    this.bind_property(
      "size",
      this._image,
      "pixel-size",
      GObject.BindingFlags.SYNC_CREATE,
    );
  }

  private _image!: Gtk.Image;

  size = 0;

  private listeners = new SignalListeners();

  setup_player() {
    const player = get_player();

    this.listeners.connect(
      player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.song_changed();
  }

  teardown_player() {
    this.listeners.clear();
  }

  /**
   * loading multiple thumbnails can result in the previous one loading
   * after the current one, so we need to abort the previous one
   */
  abort_thumbnail: AbortController | null = null;

  song_changed() {
    const player = get_player();

    const song = player.queue.current?.object;

    if (!song) return;

    if (this.abort_thumbnail != null) {
      this.abort_thumbnail.abort();
      this.abort_thumbnail = null;
    }

    // thumbnail

    this._image.icon_name = "image-missing-symbolic";

    this.abort_thumbnail = new AbortController();

    load_thumbnails(this._image, song.thumbnails, {
      width: this.size,
      signal: this.abort_thumbnail.signal,
    });
  }

  vfunc_map(): void {
    super.vfunc_map();
    this.setup_player();
  }

  vfunc_unmap(): void {
    this.teardown_player();
    super.vfunc_unmap();
  }
}
