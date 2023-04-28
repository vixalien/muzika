import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import {
  TopResult,
  TopResultAlbum,
  TopResultArtist,
  TopResultSong,
} from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { TopResultVideo } from "libmuse/types/parsers/search.js";

export class TopResultCard extends Gtk.FlowBoxChild {
  static {
    GObject.registerClass({
      GTypeName: "TopResult",
      Template:
        "resource:///com/vixalien/muzika/components/search/topresult.ui",
      InternalChildren: [
        "avatar",
        "image",
        "image_overlay",
        "title",
        "explicit",
        "label_box",
        "type",
        "type_box",
        "primary",
        "primary_content",
        "secondary",
        "secondary_content",
        // "second-line",
      ],
    }, this);
  }

  constructor() {
    super();
  }

  _avatar!: Adw.Avatar;
  _image!: Gtk.Image;
  _image_overlay!: Gtk.Overlay;
  _title!: Gtk.Label;
  _explicit!: Gtk.Label;
  _label_box!: Gtk.Box;
  _type!: Gtk.Label;
  _type_box!: Gtk.Box;
  _second_line!: Gtk.Box;
  _primary!: Gtk.Button;
  _primary_content!: Adw.ButtonContent;
  _secondary!: Gtk.Button;
  _secondary_content!: Adw.ButtonContent;

  image_size = 100;
  add_subsequent_middots = false;

  result?: TopResult;

  show_type(show: boolean) {
    this._type_box.visible = show;
  }

  show_avatar(show: boolean) {
    this._avatar.visible = show;
    this._image_overlay.visible = !show;
  }

  insert_middot(force = false) {
    if (this.add_subsequent_middots || force) {
      this._label_box.append(Gtk.Label.new("·"));
    } else {
      this.add_subsequent_middots = true;
    }
  }

  insert_only_text(text: string) {
    this._label_box.append(Gtk.Label.new(text));
  }

  insert_text(text: string) {
    this.insert_middot();
    this.insert_only_text(text);
  }

  private set_song_or_video(track: TopResultSong | TopResultVideo) {
    this.result = track;

    load_thumbnails(this._image, track.thumbnails, this.image_size);

    this._title.label = track.title;
    this._explicit.set_visible(track.isExplicit);

    track.artists.forEach((artist) => {
      this.insert_text(artist.name);
    });

    if (track.duration) this.insert_text(track.duration);

    this._secondary_content.label = "Add";
    this._secondary_content.icon_name = "list-add-symbolic";
  }

  set_song(song: TopResultSong) {
    this.set_song_or_video(song);
    this._type.label = "Song";
  }

  set_video(video: TopResultVideo) {
    this.set_song_or_video(video);
    this._type.label = "Video";
  }

  set_album(album: TopResultAlbum) {
    this.result = album;

    load_thumbnails(this._image, album.thumbnails, this.image_size);

    this._title.label = album.title;
    this._explicit.set_visible(album.isExplicit);

    this._type.label = album.album_type;

    album.artists.forEach((artist) => {
      this.insert_text(artist.name);
    });
  }

  set_artist(artist: TopResultArtist) {
    this.result = artist;

    this.show_avatar(true);
    load_thumbnails(this._avatar, artist.thumbnails, this.image_size);

    this._title.label = artist.name;

    this._type.label = "Artist";

    if (artist.subscribers) {
      this.insert_only_text(`${artist.subscribers} subscribers`);
    }

    this._secondary_content.label = "Shuffle";
    this._secondary_content.icon_name = "media-playlist-shuffle-symbolic";
  }
}
