import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { ParsedSong, ParsedVideo } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { DynamicImage } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";

export class VideoCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "VideoCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/videocard.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "channel",
        "dynamic_image",
      ],
    }, this);
  }

  video?: ParsedVideo | ParsedSong;

  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;
  _channel!: Gtk.Label;
  _dynamic_image!: DynamicImage;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_video(video: ParsedVideo) {
    this.video = video;

    this._title.tooltip_text = this._title.label = video.title;
    this._subtitle.set_label(video.views ?? "");
    this._explicit.set_visible(false);
    this._channel.set_label(video.artists?.[0].name ?? "Video");

    load_thumbnails(this._dynamic_image.picture, video.thumbnails, 160);

    if (video.videoId) {
      this._dynamic_image.setup_listeners(video.videoId);
    } else {
      this._dynamic_image.reset_listeners();
    }
  }

  set_inline_video(video: ParsedSong) {
    this.video = video;

    this._title.tooltip_text = this._title.label = video.title;
    this._subtitle.set_label(video.views ?? "");
    this._explicit.set_visible(video.isExplicit);
    this._channel.set_label(video.artists[0].name ?? "");

    load_thumbnails(this._dynamic_image.picture, video.thumbnails, 160);

    if (video.videoId) {
      this._dynamic_image.setup_listeners(video.videoId);
    } else {
      this._dynamic_image.reset_listeners();
    }
  }
}
