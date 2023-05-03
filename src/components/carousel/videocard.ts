import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { ParsedSong, ParsedVideo } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

export class VideoCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "VideoCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/videocard.ui",
      InternalChildren: [
        "image",
        "title",
        "explicit",
        "subtitle",
        "channel",
        "image",
      ],
    }, this);
  }

  video?: ParsedVideo | ParsedSong;

  _image!: Gtk.Picture;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;
  _channel!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_video(video: ParsedVideo) {
    this.video = video;

    this._title.set_label(video.title);
    this._subtitle.set_label(video.views ?? "");
    this._explicit.set_visible(false);
    this._channel.set_label(video.artists?.[0].name ?? "Video");

    load_thumbnails(this._image, video.thumbnails, 160);
  }

  set_inline_video(video: ParsedSong) {
    this.video = video;

    this._title.set_label(video.title);
    this._subtitle.set_label(video.views ?? "");
    this._explicit.set_visible(video.isExplicit);
    this._channel.set_label(video.artists[0].name ?? "");

    load_thumbnails(this._image, video.thumbnails, 160);
  }
}
