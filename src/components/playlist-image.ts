import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { Application } from "src/application.js";

export enum PlaylistImageState {
  DEFAULT,
  LOADING,
  PLAYING,
  PAUSED,
}

export interface PlaylistImageProps
  extends Partial<Gtk.Overlay.ConstructorProperties> {
  icon_size?: number;
  image_size?: number;
}

export class PlaylistImage extends Gtk.Overlay {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistImage",
      Template: "resource:///com/vixalien/muzika/ui/components/playlist-image.ui",
      InternalChildren: [
        "stack",
        "play",
        "loading",
        "pause",
        "play_image",
        "pause_image",
        "blank",
      ],
      Children: ["image"],
      Properties: {
        "icon-size": GObject.ParamSpec.int(
          "icon-size",
          "Icon size",
          "The size of the icons inside the image",
          GObject.ParamFlags.READWRITE,
          0,
          1000,
          0,
        ),
        "image-size": GObject.ParamSpec.int(
          "image-size",
          "Image size",
          "The size of the image",
          GObject.ParamFlags.READWRITE,
          0,
          1000,
          0,
        ),
        "state": GObject.ParamSpec.int(
          "state",
          "State",
          "The state of the image",
          GObject.ParamFlags.READWRITE,
          PlaylistImageState.DEFAULT,
          PlaylistImageState.PAUSED,
          PlaylistImageState.DEFAULT,
        ),
        "persistent-play-button": GObject.ParamSpec.boolean(
          "persistent-play-button",
          "Persistent play button",
          "Whether the play button should always show persistent",
          GObject.ParamFlags.READWRITE,
          true,
        ),
      },
      Signals: {
        pause: {},
        play: {},
      },
    }, this);
  }

  private _stack!: Gtk.Stack;
  private _play!: Gtk.Button;
  private _loading!: Gtk.Spinner;
  private _pause!: Gtk.Button;
  private _play_image!: Gtk.Image;
  private _pause_image!: Gtk.Image;
  private _blank!: Adw.Bin;

  image!: Gtk.Image;

  private _state: PlaylistImageState = PlaylistImageState.DEFAULT;

  get state() {
    return this._state;
  }

  set state(state: PlaylistImageState) {
    if (this._state === state) return;

    this._state = state;
    this.update_stack(this.controller.contains_pointer);
  }

  get icon_size() {
    return this._play.width_request;
  }

  set icon_size(size: number) {
    this._loading.width_request = size;

    const images = [this._play_image, this._pause_image];

    for (const image of images) {
      image.remove_css_class("lowres-icon");
      image.remove_css_class("icon-dropshadow");

      image.add_css_class(size < 32 ? "lowres-icon" : "icon-dropshadow");

      image.pixel_size = size;
    }
  }

  get image_size() {
    return this.image.pixel_size;
  }

  set image_size(size: number) {
    this.image.pixel_size = size;

    ["br-6", "br-9"].map((br_class) => {
      this.remove_css_class(br_class);
    });

    if (size <= 48) {
      this.add_css_class("br-6");
    } else {
      this.add_css_class("br-9");
    }
  }

  private _persistent_play_button = true;

  get persistent_play_button() {
    return this._persistent_play_button;
  }

  set persistent_play_button(persistent: boolean) {
    this._persistent_play_button = persistent;
    this.update_stack(this.controller.contains_pointer);
  }

  private controller: Gtk.EventControllerMotion;

  constructor(props: PlaylistImageProps = {}) {
    super(props);

    this.icon_size = props.icon_size ?? 16;
    this.image_size = props.image_size ?? 160;

    // hover events
    this.controller = new Gtk.EventControllerMotion();

    this.controller.connect("enter", () => {
      this.update_stack(true);
    });

    this.controller.connect("leave", () => {
      this.update_stack(false);
    });

    this.add_controller(this.controller);

    // pause button
    this._pause.connect("clicked", () => {
      this.emit("pause");
    });
  }

  private update_stack(hovering = false) {
    let stop_spinning = true;

    let visible = false;

    switch (this.state) {
      case PlaylistImageState.DEFAULT:
        if (hovering) {
          visible = true;
          this._stack.visible_child = this._play;
        } else {
          if (this.persistent_play_button) {
            this._stack.visible_child = this._play;
          } else {
            this._stack.visible_child = this._blank;
          }
        }
        break;
      case PlaylistImageState.LOADING:
        stop_spinning = false;
        this._stack.visible_child = this._loading;
        this._loading.spinning = true;
        visible = true;
        break;
      case PlaylistImageState.PLAYING:
        this._stack.visible_child = this._pause;
        visible = true;
        break;
      case PlaylistImageState.PAUSED:
        this._stack.visible_child = this._play;
        visible = true;
        break;
    }

    if (stop_spinning && this._loading.spinning) {
      this._loading.spinning = false;
    }

    this._stack.visible = visible;
  }

  private get_player() {
    return (Application.get_default() as Application)?.player;
  }

  private listeners: number[] = [];

  private setup_button = false;

  reset_listeners() {
    const player = this.get_player();

    if (player) {
      this.listeners.forEach((listener) => {
        player.disconnect(listener);
      });
    }

    this.listeners = [];
  }

  playlistId: string | null = null;

  setup_playlist(playlistId: string) {
    this.playlistId = playlistId;

    this.reset_listeners();

    const player = this.get_player();

    if (!this.setup_button) {
      this._play.connect("clicked", () => {
        this.emit("play");

        if (player.current_meta?.item?.track.playlist === this.playlistId) {
          player.play();
        } else if (this.playlistId) {
          this.state = PlaylistImageState.LOADING;
          player.queue.play_playlist(this.playlistId);
        }
      });

      this._pause.connect("clicked", () => {
        if (player.current_meta?.item?.track.playlist === this.playlistId) {
          player.pause();
        }
      });

      this.setup_button = true;
    }

    // if the playlist is already playing, we need to update the state
    if (
      player.current_meta?.item?.track.playlist === this.playlistId
    ) {
      if (player.playing) {
        this.state = PlaylistImageState.PLAYING;
        this.emit("play");
      } else {
        this.state = PlaylistImageState.PAUSED;
        this.emit("pause");
      }
    }

    this.listeners.push(...[
      player.connect(`start-loading::playlist::${playlistId}`, () => {
        this.state = PlaylistImageState.LOADING;
        this.emit("play");
      }),
      player.connect(`stop-loading::playlist::${playlistId}`, () => {
        if (
          player.current_meta?.item?.track.playlist === this.playlistId &&
          player.playing
        ) {
          this.state = PlaylistImageState.PLAYING;
        } else {
          this.state = PlaylistImageState.PAUSED;
        }
      }),
      player.connect(`start-playback::playlist::${playlistId}`, () => {
        this.state = PlaylistImageState.PLAYING;
      }),
      player.connect(`pause-playback::playlist::${playlistId}`, () => {
        this.state = PlaylistImageState.PAUSED;
      }),
      player.connect(`stop-playback::playlist::${playlistId}`, () => {
        this.state = PlaylistImageState.DEFAULT;
      }),
    ]);
  }

  vfunc_dispose(): void {
    this.reset_listeners();
    super.vfunc_dispose();
  }
}
