import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import { Thumbnail } from "libmuse";
import { load_thumbnails } from "./webimage";
import { DynamicAction, DynamicActionState } from "./dynamic-action";
import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";
import { FixedRatioThumbnail } from "./fixed-ratio-thumbnail";

export enum DynamicImage2StorageType {
  EMPTY = 0,
  TRACK_NUMBER,
  COVER_THUMBNAIL,
  VIDEO_THUMBNAIL,
  AVATAR,
}

export type DynamicImage2InnerChild<Type extends DynamicImage2StorageType> =
  Type extends DynamicImage2StorageType.EMPTY ? Adw.Bin
    : Type extends DynamicImage2StorageType.TRACK_NUMBER ? Gtk.Label
    : Type extends DynamicImage2StorageType.COVER_THUMBNAIL ? Gtk.Picture
    : Type extends DynamicImage2StorageType.AVATAR ? Adw.Avatar
    : Type extends DynamicImage2StorageType.VIDEO_THUMBNAIL ? Gtk.Image
    : never;

export interface DynamicImage2ConstructorProperties
  extends Gtk.Overlay.ConstructorProperties {
  size: number;
  action_size: number;
  storage_type: DynamicImage2StorageType;
  track_number: number;
  playlist: boolean;
  persistent_play_button: boolean;
}

export class DynamicImage2 extends Gtk.Overlay {
  static {
    GObject.registerClass({
      GTypeName: "DynamicImage2",
      Properties: {
        "size": GObject.ParamSpec.int(
          "size",
          "Size",
          "The size of the dynamic image",
          GObject.ParamFlags.READWRITE,
          0,
          1000000,
          0,
        ),
        "action-size": GObject.ParamSpec.int(
          "action-size",
          "Action Size",
          "The size of the inset dynamic action",
          GObject.ParamFlags.READWRITE,
          0,
          1000000,
          0,
        ),
        "state": GObject.ParamSpec.uint(
          "state",
          "State",
          "The current state of the dynamic action",
          GObject.ParamFlags.READWRITE,
          DynamicActionState.DEFAULT,
          DynamicActionState.PAUSED,
          DynamicActionState.DEFAULT,
        ),
        "storage-type": GObject.ParamSpec.uint(
          "storage-type",
          "Storage Type",
          "The current type of child being shown by this dynamic image",
          GObject.ParamFlags.READABLE,
          DynamicImage2StorageType.EMPTY,
          DynamicImage2StorageType.AVATAR,
          DynamicImage2StorageType.EMPTY,
        ),
        "track-number": GObject.ParamSpec.int(
          "track-number",
          "Track Number",
          "Track Number displayed by this dynamic image",
          GObject.ParamFlags.READWRITE,
          0,
          1000000,
          0,
        ),
        "playlist": GObject.ParamSpec.boolean(
          "playlist",
          "Playlist",
          "Whether this dynamic image is showing a playlist",
          GObject.ParamFlags.READWRITE,
          false,
        ),
        "persistent-play-button": GObject.ParamSpec.boolean(
          "persistent-play-button",
          "Persistent Play Button",
          "Whether to always show the play button",
          GObject.ParamFlags.READWRITE,
          false,
        ),
        can_expand: GObject.ParamSpec.boolean(
          "can-expand",
          "Can Expand",
          "Whether to expand the image to fill the available space",
          GObject.ParamFlags.READWRITE,
          false,
        ),
      },
      Signals: {
        play: {},
        pause: {},
      },
    }, this);
  }

  private action = new DynamicAction();

  private listeners = new SignalListeners();

  constructor(props: Partial<DynamicImage2ConstructorProperties> = {}) {
    super({
      overflow: Gtk.Overflow.HIDDEN,
    });

    this.add_overlay(this.action);

    this.controller = new Gtk.EventControllerMotion();

    this.controller.connect("enter", () => {
      this.action.hovering = true;
    });

    this.controller.connect("leave", () => {
      this.action.hovering = false;
    });

    this.add_controller(this.controller);

    this.listeners.connect(this.action, "play", this.play_cb.bind(this));
    this.listeners.connect(this.action, "pause", this.pause_cb.bind(this));

    this.action.fill = props?.playlist ?? true;

    if (props.size) this.size = props.size;
    if (props.action_size) this.action_size = props.action_size;
    if (props.storage_type) this.storage_type = props.storage_type;
    if (props.track_number) this.track_number = props.track_number;
    if (props.persistent_play_button != null) {
      this.persistent_play_button = props.persistent_play_button;
    }
  }

  private controller: Gtk.EventControllerMotion;

  // child methods

  private update_image_class() {
    if (
      this.storage_type !== DynamicImage2StorageType.COVER_THUMBNAIL &&
      this.storage_type !== DynamicImage2StorageType.VIDEO_THUMBNAIL
    ) return;

    const all_classes = ["icon-dropshadow", "lowres-icon", "br-6", "br-9"];
    const classes = ["card"];

    if (this.size <= 48) {
      classes.push("lowres-icon");
      classes.push("br-6");
    } else {
      classes.push("icon-dropshadow");
      classes.push("br-9");
    }

    all_classes.filter((c) => !classes.includes(c)).forEach((c) => {
      this.remove_css_class(c);
    });

    classes.forEach((c) => {
      this.add_css_class(c);
    });
  }

  private update_size() {
    const child = this.get_child();

    if (!child) return;

    switch (this.storage_type) {
      case DynamicImage2StorageType.EMPTY: {
        const bin = child as Adw.Bin;
        bin.width_request = bin.height_request = this.size;
        break;
      }
      case DynamicImage2StorageType.COVER_THUMBNAIL: {
        const image = child as FixedRatioThumbnail;
        image.min_width = image.min_height = this.size;
        this.update_image_class();
        break;
      }
      case DynamicImage2StorageType.AVATAR: {
        const avatar = child as Adw.Avatar;
        avatar.size = this.size;
        break;
      }
      case DynamicImage2StorageType.VIDEO_THUMBNAIL: {
        const image = child as FixedRatioThumbnail;
        image.min_width = (16 / 9) * this.size;
        image.min_height = this.size;
        this.update_image_class();
        break;
      }
      case DynamicImage2StorageType.TRACK_NUMBER: {
        const label = child as Gtk.Label;
        label.width_request = label.height_request = this.size;
        break;
      }
    }
  }

  // property: can-expand

  private _can_expand = false;

  get can_expand() {
    return this._can_expand;
  }

  set can_expand(value: boolean) {
    if (this._can_expand === value) return;

    this._can_expand = value;
    this.notify("can-expand");

    const child = this.get_child();

    if (child instanceof FixedRatioThumbnail) {
      child.can_expand = this.can_expand;
    }
  }

  private initialize_type(type: DynamicImage2StorageType) {
    if (this.storage_type === type) {
      this.update_size();
      return;
    }

    let child: Gtk.Widget;

    switch (type) {
      case DynamicImage2StorageType.EMPTY:
        child = Adw.Bin.new();
        break;
      case DynamicImage2StorageType.COVER_THUMBNAIL:
        child = new FixedRatioThumbnail({
          overflow: Gtk.Overflow.HIDDEN,
        });
        (child as FixedRatioThumbnail).aspect_ratio = 1;
        (child as FixedRatioThumbnail).can_expand = this.can_expand;
        break;
      case DynamicImage2StorageType.VIDEO_THUMBNAIL:
        child = new FixedRatioThumbnail({
          overflow: Gtk.Overflow.HIDDEN,
        });
        (child as FixedRatioThumbnail).aspect_ratio = 16 / 9;
        (child as FixedRatioThumbnail).can_expand = this.can_expand;
        break;
      case DynamicImage2StorageType.AVATAR:
        this.action.locked = true;

        child = new Adw.Avatar({
          overflow: Gtk.Overflow.HIDDEN,
        });
        child.add_css_class("rounded");
        // TODO: get rid of this
        // see https://gitlab.gnome.org/GNOME/gtk/-/issues/5960
        child.add_css_class("card");
        break;
      case DynamicImage2StorageType.TRACK_NUMBER:
        child = new Gtk.Label();
        child.add_css_class("heading");
        child.add_css_class("dim-label");
        break;
    }

    this._storage_type = type;
    this.child = child;

    this.update_size();
  }

  // property: playlist

  private _playlist = false;

  get playlist() {
    return this._playlist;
  }

  set playlist(playlist: boolean) {
    if (playlist == this._playlist) return;

    this.action.fill = !playlist;
  }

  // property: size

  private _size = 0;

  get size() {
    return this._size;
  }

  set size(size: number) {
    this._size = size;
    this.update_size();
  }

  // property: dynamic-image

  get persistent_play_button() {
    return this.action.persistent_play_button;
  }

  set persistent_play_button(size: boolean) {
    this.action.persistent_play_button = size;
  }

  // property: action-size

  get action_size() {
    return this.action.size;
  }

  set action_size(size: number) {
    this.action.size = size;
  }

  // property: storage type

  private _storage_type: DynamicImage2StorageType =
    DynamicImage2StorageType.EMPTY;

  get storage_type() {
    return this._storage_type;
  }

  private set storage_type(type: DynamicImage2StorageType) {
    this.initialize_type(type);
  }

  // setters for type

  // setters: number

  get track_number() {
    const child = this.child as Gtk.Label;

    if (!child) return null;

    if (
      this.storage_type === DynamicImage2StorageType.TRACK_NUMBER && this.child
    ) {
      const number = +new Number(child.label);
      return Number.isNaN(number) ? null : number;
    } else {
      return null;
    }
  }

  set track_number(number: number | null) {
    this.storage_type = DynamicImage2StorageType.TRACK_NUMBER;

    const child = this.child as Gtk.Label;

    if (!child) return;

    if (number != null) {
      child.set_label(number.toString());
    } else {
      child.set_label("");
    }
  }

  // property: state

  get state() {
    return this.action.state;
  }

  set state(state: DynamicActionState) {
    this.action.state = state;
  }

  private thumbnails: Thumbnail[] | null = null;

  // setters: cover_thumbnails

  set cover_thumbnails(thumbnails: Thumbnail[] | null) {
    if (thumbnails === null) return;

    this.storage_type = DynamicImage2StorageType.COVER_THUMBNAIL;

    const child = this.child as Gtk.Image;

    this.thumbnails = thumbnails;
    // TODO: load the thumbnails on map

    load_thumbnails(child, thumbnails, this.size);
  }

  get cover_thumbnails() {
    if (this.storage_type === DynamicImage2StorageType.COVER_THUMBNAIL) {
      return this.thumbnails;
    } else {
      return null;
    }
  }

  // setters: video_thumbnails

  set video_thumbnails(thumbnails: Thumbnail[] | null) {
    if (thumbnails === null) return;

    this.storage_type = DynamicImage2StorageType.VIDEO_THUMBNAIL;

    const child = this.child as Gtk.Picture;

    this.thumbnails = thumbnails;
    // TODO: load the thumbnails on map

    load_thumbnails(child, thumbnails, this.size);
  }

  get video_thumbnails() {
    if (this.storage_type === DynamicImage2StorageType.VIDEO_THUMBNAIL) {
      return this.thumbnails;
    } else {
      return null;
    }
  }

  // setters: avatar_thumbnails

  set avatar_thumbnails(thumbnails: Thumbnail[] | null) {
    if (thumbnails === null) return;

    this.storage_type = DynamicImage2StorageType.AVATAR;

    const child = this.child as Adw.Avatar;

    this.thumbnails = thumbnails;
    // TODO: load the thumbnails on map

    load_thumbnails(child, thumbnails, this.size);
  }

  get avatar_thumbnails() {
    if (this.storage_type === DynamicImage2StorageType.AVATAR) {
      return this.thumbnails;
    } else {
      return null;
    }
  }

  private videoId: string | null = null;
  private playlistId: string | null = null;

  setup_video(videoId: string, playlistId: string | null = null) {
    this.videoId = videoId;
    this.playlistId = playlistId;
  }

  setup_playlist(playlistId: string) {
    this.playlistId = playlistId;
  }

  private play_cb() {
    const player = get_player();

    this.emit("play");

    if (player.now_playing?.object.track.videoId === this.videoId) {
      player.play();
    } else if (this.playlistId) {
      this.state = DynamicActionState.LOADING;
      player.queue.play_playlist(this.playlistId, this.videoId ?? undefined);
    } else if (this.videoId) {
      this.state = DynamicActionState.LOADING;
      player.queue.play_song(this.videoId);
    }
  }

  private pause_cb() {
    const player = get_player();

    this.emit("pause");

    if (this.playlistId && !this.videoId) {
      if (player.now_playing?.object.track.playlist === this.playlistId) {
        player.pause();
      }
    } else if (player.now_playing?.object.track.videoId === this.videoId) {
      player.pause();
    }
  }

  clear() {
    this.listeners.clear();
  }
}
