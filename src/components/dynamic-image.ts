import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";

import { Application } from "src/application.js";
import { Window } from "src/window.js";

export enum DynamicImageState {
  DEFAULT,
  LOADING,
  PLAYING,
  PAUSED,
}

export enum DynamicImageVisibleChild {
  IMAGE,
  PICTURE,
  NUMBER,
}

export class DynamicImage extends Gtk.Overlay {
  static {
    GObject.registerClass({
      GTypeName: "DynamicImage",
      Template: "resource:///com/vixalien/muzika/components/dynamic-image.ui",
      InternalChildren: [
        "stack",
        "play",
        "play_image",
        "wave",
        "loading",
        "pause",
        "pause_image",
        "blank",
        "image_stack",
        "number",
      ],
      Children: ["image", "picture"],
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
          DynamicImageState.DEFAULT,
          DynamicImageState.PAUSED,
          DynamicImageState.DEFAULT,
        ),
        "persistent-play-button": GObject.ParamSpec.boolean(
          "persistent-play-button",
          "Persistent play button",
          "Whether the play button should alwas show persistent",
          GObject.ParamFlags.READWRITE,
          true,
        ),
        "visible-child": GObject.ParamSpec.uint(
          "visible-child",
          "The visible child",
          "Whether the image, picture or number should be visible",
          GObject.ParamFlags.READWRITE,
          DynamicImageVisibleChild.IMAGE,
          DynamicImageVisibleChild.NUMBER,
          DynamicImageVisibleChild.IMAGE,
        ),
        "track-number": GObject.ParamSpec.string(
          "track-number",
          "Track Number",
          "The track number of the image",
          GObject.ParamFlags.READWRITE,
          "",
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
  private _play_image!: Gtk.Image;
  private _wave!: Gtk.Image;
  private _loading!: Gtk.Spinner;
  private _pause!: Gtk.Button;
  private _pause_image!: Gtk.Image;
  private _blank!: Gtk.Box;
  private _image_stack!: Gtk.Stack;
  private _number!: Gtk.Label;

  image!: Gtk.Image;
  picture!: Gtk.Picture;

  private _state: DynamicImageState = DynamicImageState.DEFAULT;

  get state() {
    return this._state;
  }

  set state(state: DynamicImageState) {
    this._state = state;
    this.update_stack(this.controller.contains_pointer);
  }

  get icon_size() {
    return this._wave.pixel_size;
  }

  set icon_size(size: number) {
    this._loading.width_request = size;

    const images = [this._play_image, this._wave, this._pause_image];

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

    this._number.width_request = this._number.height_request = size;

    this.picture.height_request = size;
    this.picture.width_request = size * (16 / 9);

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

  get visible_child() {
    return this._image_stack.visible_child === this.picture
      ? DynamicImageVisibleChild.PICTURE
      : this._image_stack.visible_child === this._number
      ? DynamicImageVisibleChild.NUMBER
      : DynamicImageVisibleChild.IMAGE;
  }

  set visible_child(child: DynamicImageVisibleChild) {
    switch (child) {
      case DynamicImageVisibleChild.IMAGE:
        this._image_stack.visible_child = this.image;
        break;
      case DynamicImageVisibleChild.PICTURE:
        this._image_stack.visible_child = this.picture;
        break;
      case DynamicImageVisibleChild.NUMBER:
        this._image_stack.visible_child = this._number;
        break;
    }
  }

  get track_number() {
    return this._number.label;
  }

  set track_number(number: string) {
    this._number.label = number;

    this.visible_child = DynamicImageVisibleChild.NUMBER;
  }

  private controller: Gtk.EventControllerMotion;

  constructor(props: DynamicImageProps = {}) {
    super(props);

    this.icon_size = props.icon_size ?? 32;
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

    let osd = false;

    switch (this.state) {
      case DynamicImageState.DEFAULT:
        if (hovering) {
          osd = true;
          this._stack.visible_child = this._play;
        } else {
          if (this.persistent_play_button) {
            this._stack.visible_child = this._play;
          } else {
            this._stack.visible_child = this._blank;
          }
        }
        break;
      case DynamicImageState.LOADING:
        stop_spinning = false;
        this._stack.visible_child = this._loading;
        this._loading.spinning = true;
        osd = true;
        break;
      case DynamicImageState.PLAYING:
        if (hovering) {
          this._stack.visible_child = this._pause;
        } else {
          this._stack.visible_child = this._wave;
        }
        osd = true;
        break;
      case DynamicImageState.PAUSED:
        this._stack.visible_child = this._play;
        osd = true;
        break;
    }

    if (stop_spinning && this._loading.spinning) {
      this._loading.spinning = false;
    }

    // for number, don't use osd, but instead hide the number label
    if (this.visible_child === DynamicImageVisibleChild.NUMBER) {
      this._image_stack.opacity = osd ? 0 : 1;
      this._stack.remove_css_class("osd");
    } else {
      this._image_stack.opacity = 1;
      if (osd) {
        this._stack.add_css_class("osd");
      } else {
        this._stack.remove_css_class("osd");
      }
    }
  }

  private get_player() {
    return ((this.get_root() as Window)?.application as Application)
      ?.player;
  }

  private listeners: number[] = [];

  private map_listener: number | null = null;

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

  videoId: string | null = null;
  playlistId: string | null = null;

  setup_listeners(videoId: string, playlistId: string | null = null) {
    this.videoId = videoId;
    this.playlistId = playlistId;

    if (this.map_listener != null) {
      this.disconnect(this.map_listener);
    }

    this.reset_listeners();

    const player = this.get_player();

    if (!player) {
      this.map_listener = this.connect("map", () => {
        this.setup_listeners(videoId, playlistId);
      });
      return;
    }

    if (!this.setup_button) {
      this._play.connect("clicked", () => {
        this.emit("play");

        if (player.current_meta?.item?.track.videoId === this.videoId) {
          player.play();
        } else if (this.videoId) {
          if (this.playlistId) {
            this.state = DynamicImageState.LOADING;
            player.queue.play_playlist(this.playlistId, this.videoId);
          } else {
            this.state = DynamicImageState.LOADING;
            player.queue.play_song(this.videoId);
          }
        }
      });

      this._pause.connect("clicked", () => {
        if (player.current_meta?.item?.track.videoId === this.videoId) {
          player.pause();
        }
      });

      this.setup_button = true;
    }

    // if the video is already playing, we need to update the state
    if (
      player.current_meta?.item?.track.videoId === this.videoId
    ) {
      if (player.playing) {
        this.state = DynamicImageState.PLAYING;
        this.emit("play");
      } else {
        this.state = DynamicImageState.PAUSED;
        this.emit("pause");
      }
    }

    this.listeners.push(...[
      player.connect(`start-loading::${videoId}`, () => {
        this.state = DynamicImageState.LOADING;
        this.emit("play");
      }),
      player.connect(`stop-loading::${videoId}`, () => {
        if (
          player.current_meta?.item?.track.videoId === this.videoId &&
          player.playing
        ) {
          this.state = DynamicImageState.PLAYING;
        } else {
          this.state = DynamicImageState.PAUSED;
        }
      }),
      player.connect(`start-playback::${videoId}`, () => {
        this.state = DynamicImageState.PLAYING;
      }),
      player.connect(`pause-playback::${videoId}`, () => {
        this.state = DynamicImageState.PAUSED;
      }),
      player.connect(`stop-playback::${videoId}`, () => {
        this.state = DynamicImageState.DEFAULT;
      }),
    ]);
  }
}

export interface DynamicImageProps
  extends Partial<Gtk.Overlay.ConstructorProperties> {
  icon_size?: number;
  image_size?: number;
}
