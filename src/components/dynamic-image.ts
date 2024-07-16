import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { Thumbnail } from "libmuse";
import { load_thumbnails } from "./webimage";
import {
  DynamicAction,
  DynamicActionState,
  get_state_pspec,
} from "./dynamic-action";
import { SignalListeners } from "src/util/signal-listener";
import { get_player } from "src/application";
import { FixedRatioThumbnail } from "./fixed-ratio-thumbnail";

export { DynamicActionState };

export enum DynamicImageStorageType {
  EMPTY = 0,
  TRACK_NUMBER,
  COVER_THUMBNAIL,
  VIDEO_THUMBNAIL,
  AVATAR,
}

export type DynamicImageInnerChild<Type extends DynamicImageStorageType> =
  Type extends DynamicImageStorageType.EMPTY
    ? Adw.Bin
    : Type extends DynamicImageStorageType.TRACK_NUMBER
      ? Gtk.Label
      : Type extends DynamicImageStorageType.COVER_THUMBNAIL
        ? Gtk.Picture
        : Type extends DynamicImageStorageType.AVATAR
          ? Adw.Avatar
          : Type extends DynamicImageStorageType.VIDEO_THUMBNAIL
            ? Gtk.Image
            : never;

export interface DynamicImageConstructorProperties
  extends Gtk.Overlay.ConstructorProperties {
  size: number;
  action_size: number;
  storage_type: DynamicImageStorageType;
  track_number: number;
  playlist: boolean;
  persistent_play_button: boolean;
}

export class DynamicImage extends Gtk.Overlay {
  static {
    GObject.registerClass(
      {
        GTypeName: "DynamicImage",
        Template:
          "resource:///com/vixalien/muzika/ui/components/dynamic-image.ui",
        InternalChildren: ["container", "action", "check"],
        Properties: {
          size: GObject.ParamSpec.int(
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
          state: get_state_pspec(),
          "storage-type": GObject.ParamSpec.uint(
            "storage-type",
            "Storage Type",
            "The current type of child being shown by this dynamic image",
            GObject.ParamFlags.READABLE,
            DynamicImageStorageType.EMPTY,
            DynamicImageStorageType.AVATAR,
            DynamicImageStorageType.EMPTY,
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
          playlist: GObject.ParamSpec.boolean(
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
          "selection-mode": GObject.ParamSpec.boolean(
            "selection-mode",
            "Selection mode",
            "Whether the image is in selection mode",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          selected: GObject.ParamSpec.boolean(
            "selected",
            "Selected",
            "Whether the image is selected",
            GObject.ParamFlags.READWRITE,
            false,
          ),
          "action-locked": GObject.ParamSpec.boolean(
            "action-locked",
            "Action Locked",
            "Whether the action is locked",
            GObject.ParamFlags.READWRITE,
            false,
          ),
        },
        Signals: {
          play: {},
          pause: {},
        },
      },
      this,
    );
  }

  private _container!: Adw.Bin;
  private _action!: DynamicAction;
  private _check!: Gtk.CheckButton;

  private listeners = new SignalListeners();

  constructor(props: Partial<DynamicImageConstructorProperties> = {}) {
    super();

    this._action.fill = props?.playlist ?? true;

    if (props.size) this.size = props.size;
    if (props.action_size) this.action_size = props.action_size;
    if (props.storage_type) this.storage_type = props.storage_type;
    if (props.track_number) this.track_number = props.track_number;
    if (props.persistent_play_button != null) {
      this.persistent_play_button = props.persistent_play_button;
    }
  }

  private hover_enter_cb() {
    this._action.hovering = true;
  }

  private hover_leave_cb() {
    this._action.hovering = false;
  }

  // child methods

  private update_image_class() {
    if (
      this.storage_type !== DynamicImageStorageType.COVER_THUMBNAIL &&
      this.storage_type !== DynamicImageStorageType.VIDEO_THUMBNAIL
    )
      return;

    const all_classes = [
      "icon-dropshadow",
      "lowres-icon",
      "br-6",
      "br-9",
      "card",
    ];
    const classes = this.selection_mode ? [] : ["card"];

    if (this.size <= 48) {
      classes.push("lowres-icon");
      classes.push("br-6");
    } else {
      classes.push("icon-dropshadow");
      classes.push("br-9");
    }

    all_classes
      .filter((c) => !classes.includes(c))
      .forEach((c) => {
        this.remove_css_class(c);
      });

    classes.forEach((c) => {
      this.add_css_class(c);
    });
  }

  private update_size() {
    const child = this.visible_child;

    if (!child) return;

    switch (this.storage_type) {
      case DynamicImageStorageType.EMPTY: {
        const bin = child as Adw.Bin;
        bin.width_request = bin.height_request = this.size;
        break;
      }
      case DynamicImageStorageType.COVER_THUMBNAIL: {
        const image = child as FixedRatioThumbnail;
        image.min_width = image.min_height = this.size;
        this.update_image_class();
        break;
      }
      case DynamicImageStorageType.AVATAR: {
        const avatar = child as Adw.Avatar;
        avatar.size = this.size;
        break;
      }
      case DynamicImageStorageType.VIDEO_THUMBNAIL: {
        const picture = child as Gtk.Picture;
        picture.width_request = (16 / 9) * this.size;
        picture.height_request = this.size;
        this.update_image_class();
        break;
      }
      case DynamicImageStorageType.TRACK_NUMBER: {
        const label = child as Gtk.Label;
        label.width_request = label.height_request = this.size;
        break;
      }
    }
  }

  // util property: visible-child

  public get visible_child(): Gtk.Widget {
    return this._container.child;
  }

  public set visible_child(v: Gtk.Widget) {
    this._container.child = v;
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

    if (this.visible_child instanceof FixedRatioThumbnail) {
      this.visible_child.can_expand = this.can_expand;
    }
  }

  private check_toggled_cb() {
    if (this.selection_mode) {
      this.notify("selected");
    }
  }

  private initialize_type(type: DynamicImageStorageType) {
    if (this.storage_type === type) {
      this.update_size();
      return;
    }

    let child: Gtk.Widget;

    switch (type) {
      case DynamicImageStorageType.EMPTY:
        child = Adw.Bin.new();
        break;
      case DynamicImageStorageType.COVER_THUMBNAIL:
        child = new FixedRatioThumbnail({
          overflow: Gtk.Overflow.HIDDEN,
        });
        (child as FixedRatioThumbnail).aspect_ratio = 1;
        (child as FixedRatioThumbnail).can_expand = this.can_expand;
        (child as FixedRatioThumbnail).orientation = Gtk.Orientation.VERTICAL;
        break;
      case DynamicImageStorageType.VIDEO_THUMBNAIL:
        child = new Gtk.Picture({
          overflow: Gtk.Overflow.HIDDEN,
          content_fit: Gtk.ContentFit.FILL,
        });
        break;
      case DynamicImageStorageType.AVATAR:
        this._action.locked = true;

        child = new Adw.Avatar({
          overflow: Gtk.Overflow.HIDDEN,
        });
        child.add_css_class("rounded");
        // TODO: get rid of this
        // see https://gitlab.gnome.org/GNOME/gtk/-/issues/5960
        child.add_css_class("card");
        break;
      case DynamicImageStorageType.TRACK_NUMBER:
        child = new Gtk.Label();
        child.add_css_class("heading");
        child.add_css_class("dim-label");
        break;
    }

    this._storage_type = type;
    this.visible_child = child;

    this.update_size();
  }

  // property: playlist

  private _playlist = false;

  get playlist() {
    return this._playlist;
  }

  set playlist(playlist: boolean) {
    if (playlist == this._playlist) return;

    this._action.fill = !playlist;
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
    return this._action.persistent_play_button;
  }

  set persistent_play_button(size: boolean) {
    this._action.persistent_play_button = size;
  }

  // property: action-size

  get action_size() {
    return this._action.size;
  }

  set action_size(size: number) {
    this._action.size = size;
  }

  // property: storage type

  private _storage_type: DynamicImageStorageType =
    DynamicImageStorageType.EMPTY;

  get storage_type() {
    return this._storage_type;
  }

  private set storage_type(type: DynamicImageStorageType) {
    this.initialize_type(type);
  }

  // property: selected

  get selected() {
    return this._check.active;
  }

  set selected(selected: boolean) {
    this._check.active = selected;
  }

  // property: selection-mode

  get selection_mode() {
    return this._check.visible;
  }

  set selection_mode(selection_mode: boolean) {
    this._check.visible = selection_mode;
    this._container.visible = this._action.visible = !selection_mode;

    this.width_request = this.height_request = selection_mode ? this.size : -1;

    this.update_image_class();
  }

  // setters for type

  // setters: number

  get track_number() {
    const child = this.visible_child as Gtk.Label;

    if (!child) return null;

    if (
      this.storage_type === DynamicImageStorageType.TRACK_NUMBER &&
      this.visible_child
    ) {
      const number = +new Number(child.label);
      return Number.isNaN(number) ? null : number;
    } else {
      return null;
    }
  }

  set track_number(number: number | null) {
    this.storage_type = DynamicImageStorageType.TRACK_NUMBER;

    const child = this.visible_child as Gtk.Label;

    if (!child) return;

    if (number != null) {
      child.set_label(number.toString());
    } else {
      child.set_label("");
    }
  }

  // property: state

  get state() {
    return this._action.state;
  }

  set state(state: DynamicActionState) {
    this._action.state = state;
  }

  private thumbnails: Thumbnail[] | null = null;

  // setters: cover_thumbnails

  set cover_thumbnails(thumbnails: Thumbnail[] | null) {
    if (thumbnails === null) return;

    this.storage_type = DynamicImageStorageType.COVER_THUMBNAIL;

    const child = this.visible_child as Gtk.Image;

    this.thumbnails = thumbnails;
    // TODO: load the thumbnails on map

    load_thumbnails(child, thumbnails, this.size);
  }

  get cover_thumbnails() {
    if (this.storage_type === DynamicImageStorageType.COVER_THUMBNAIL) {
      return this.thumbnails;
    } else {
      return null;
    }
  }

  // setters: video_thumbnails

  set video_thumbnails(thumbnails: Thumbnail[] | null) {
    if (thumbnails === null) return;

    this.storage_type = DynamicImageStorageType.VIDEO_THUMBNAIL;

    const child = this.visible_child as Gtk.Picture;

    this.thumbnails = thumbnails;
    // TODO: load the thumbnails on map

    load_thumbnails(child, thumbnails, this.size);
  }

  get video_thumbnails() {
    if (this.storage_type === DynamicImageStorageType.VIDEO_THUMBNAIL) {
      return this.thumbnails;
    } else {
      return null;
    }
  }

  // setters: avatar_thumbnails

  set avatar_thumbnails(thumbnails: Thumbnail[] | null) {
    if (thumbnails === null) return;

    this.storage_type = DynamicImageStorageType.AVATAR;

    const child = this.visible_child as Adw.Avatar;

    this.thumbnails = thumbnails;
    child.text = thumbnails[0].url;
    // TODO: load the thumbnails on map

    load_thumbnails(child, thumbnails, this.size);
  }

  get avatar_thumbnails() {
    if (this.storage_type === DynamicImageStorageType.AVATAR) {
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
      player.queue.add_playlist2(this.playlistId, this.videoId ?? undefined, {
        play: true,
      });
    } else if (this.videoId) {
      this.state = DynamicActionState.LOADING;
      player.queue.add_songs2([this.videoId], { radio: true, play: true });
    }
  }

  private pause_cb() {
    const player = get_player();

    this.emit("pause");

    if (this.playlistId && !this.videoId) {
      if (player.queue.playlist_id === this.playlistId) {
        player.pause();
      }
    } else if (player.now_playing?.object.track.videoId === this.videoId) {
      player.pause();
    }
  }

  private setup_listeners() {
    this.listeners.connect(this._action, "play", this.play_cb.bind(this));
    this.listeners.connect(this._action, "pause", this.pause_cb.bind(this));
  }

  private _clear() {
    this.listeners.clear();
  }

  public get action_locked(): boolean {
    return this._action.locked;
  }

  public set action_locked(v: boolean) {
    this._action.locked = v;
  }

  vfunc_unmap(): void {
    this._clear();
    super.vfunc_unmap();
  }

  vfunc_map(): void {
    super.vfunc_map();
    this.setup_listeners();
  }
}
