import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import { Thumbnail } from "libmuse";
import { load_thumbnails } from "./webimage";

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
      },
    }, this);
  }

  // child methods

  private update_image_class() {
    const child = this.get_child();

    if (
      this.storage_type !== DynamicImage2StorageType.COVER_THUMBNAIL &&
      this.storage_type !== DynamicImage2StorageType.VIDEO_THUMBNAIL
    ) return;

    if (!child) return;

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
      child.remove_css_class(c);
    });

    classes.forEach((c) => {
      child.add_css_class(c);
    });
  }

  private update_size() {
    const child = this.get_child();

    if (!child) return;

    switch (this.storage_type) {
      case DynamicImage2StorageType.EMPTY:
        const bin = child as Adw.Bin;
        bin.width_request = bin.height_request = this.size;
        break;
      case DynamicImage2StorageType.COVER_THUMBNAIL:
        const image = child as Gtk.Image;
        image.pixel_size = this.size;
        this.update_image_class();
        break;
      case DynamicImage2StorageType.AVATAR:
        const avatar = child as Adw.Avatar;
        avatar.size = this.size;
        break;
      case DynamicImage2StorageType.VIDEO_THUMBNAIL:
        const picture = child as Gtk.Picture;
        picture.width_request = (16 / 9) * this.size;
        picture.height_request = this.size;
        this.update_image_class();
        break;
      case DynamicImage2StorageType.TRACK_NUMBER:
        const label = child as Gtk.Label;
        label.width_request = label.height_request = this.size;
        break;
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
        child = new Gtk.Image({
          overflow: Gtk.Overflow.HIDDEN,
        });
        break;
      case DynamicImage2StorageType.AVATAR:
        child = new Adw.Avatar();
        break;
      case DynamicImage2StorageType.VIDEO_THUMBNAIL:
        child = new Gtk.Picture({
          overflow: Gtk.Overflow.HIDDEN,
        });
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

  // property: size

  private _size = 0;

  get size() {
    return this._size;
  }

  set size(size: number) {
    this._size = size;
    this.update_size();
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
}
