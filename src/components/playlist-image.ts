import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { get_player } from "src/application.js";
import { Thumbnail } from "libmuse";
import { load_thumbnails } from "./webimage";
import { AdaptivePicture } from "./adaptive-picture";

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
      Template:
        "resource:///com/vixalien/muzika/ui/components/playlist-image.ui",
      InternalChildren: [
        "stack",
        "play",
        "loading",
        "pause",
        "play_image",
        "pause_image",
        "blank",
      ],
      Children: ["picture"],
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

  picture!: AdaptivePicture;

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
    return this.picture.min_width;
  }

  set image_size(size: number) {
    this.picture.min_width = this.picture.min_height = size;

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

    // hover events
    this.controller = new Gtk.EventControllerMotion();

    this.controller.connect("enter", () => {
      this.update_stack(true);
    });

    this.controller.connect("leave", () => {
      this.update_stack(false);
    });

    this.add_controller(this.controller);

    if (props.icon_size) this.icon_size = props.icon_size;
    if (props.image_size) this.image_size = props.image_size;
    if (props.persistent_play_button != null) {
      this.persistent_play_button = props.persistent_play_button;
    }
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

  playlistId: string | null = null;

  setup_playlist(playlistId: string) {
    this.playlistId = playlistId;
  }

  private play_cb() {
    const player = get_player();

    this.emit("play");

    if (player.now_playing?.object.settings.playlistId === this.playlistId) {
      player.play();
    } else if (this.playlistId) {
      this.state = PlaylistImageState.LOADING;
      player.queue.play_playlist(this.playlistId);
    }
  }

  private pause_cb() {
    const player = get_player();

    this.emit("pause");

    if (player.now_playing?.object.settings.playlistId === this.playlistId) {
      player.pause();
    }
  }

  load_thumbnails(
    thumbnails: Thumbnail[],
    options: Parameters<typeof load_thumbnails>[2] = this.image_size,
  ) {
    return load_thumbnails(
      this.picture,
      thumbnails,
      options,
    );
  }
}
