import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import {
  ParsedAlbum,
  ParsedPlaylist,
  ParsedSong,
  ParsedVideo,
  RelatedArtist,
  WatchPlaylist,
} from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { RequiredMixedItem } from "../carousel/index.js";
import { ParsedLibraryArtist } from "libmuse/types/parsers/library.js";

export type MixedCardItem = RequiredMixedItem | ParsedLibraryArtist;

export class MixedCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "MixedCard",
      Template:
        "resource:///com/vixalien/muzika/ui/components/library/mixedcard.ui",
      InternalChildren: [
        "avatar",
        "image",
        "image_overlay",
        "title",
        "explicit",
        "label_box",
        "type",
        "type_box",
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

  image_size = 48;
  add_subsequent_middots = false;

  content?: MixedCardItem;

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

  private set_song_or_video(track: ParsedSong | ParsedVideo) {
    this.content = track;

    load_thumbnails(this._image, track.thumbnails, this.image_size);

    this._title.label = track.title;
  }

  set_song(song: ParsedSong) {
    this.set_song_or_video(song);
    this._type.label = _("Song");

    this._explicit.set_visible(song.isExplicit);
    if (song.duration) this.insert_text(song.duration);

    song.artists.forEach((artist) => {
      this.insert_text(artist.name);
    });
  }

  set_video(video: ParsedVideo) {
    // this._image.width_request = 85.5;
    this.set_song_or_video(video);
    this._type.label = _("Video");
  }

  set_album(album: ParsedAlbum) {
    this.content = album;

    load_thumbnails(this._image, album.thumbnails, this.image_size);

    this._title.label = album.title;
    this._explicit.set_visible(album.isExplicit);

    this._type.label = album.album_type ?? _("Album");

    album.artists.forEach((artist) => {
      this.insert_text(artist.name);
    });
  }

  set_watch_playlist(playlist: WatchPlaylist) {
    this.content = playlist;

    load_thumbnails(this._image, playlist.thumbnails, this.image_size);

    this._title.label = playlist.title;

    this._type.label = _("Start Radio");
  }

  set_playlist(playlist: ParsedPlaylist) {
    this.content = playlist;

    load_thumbnails(this._image, playlist.thumbnails, this.image_size);

    this._title.label = playlist.title;

    this._type.label = _("Playlist");

    if (playlist.authors) {
      playlist.authors.forEach((artist) => {
        this.insert_text(artist.name);
      });
    }
  }

  set_artist(artist: RelatedArtist) {
    this.content = artist;

    this.show_avatar(true);
    load_thumbnails(this._avatar, artist.thumbnails, this.image_size);

    this._title.label = artist.name;

    this.show_type(false);

    if (artist.subscribers) {
      this.insert_only_text(artist.subscribers);
    }
  }

  set_library_artist(artist: ParsedLibraryArtist) {
    this.content = artist;

    this.show_avatar(true);
    load_thumbnails(this._avatar, artist.thumbnails, this.image_size);

    this._title.label = artist.name;

    this.show_type(false);

    this.insert_only_text(artist.subscribers ?? artist.songs ?? "");
  }

  set_item(item: MixedCardItem) {
    switch (item.type) {
      case "album":
        this.set_album(item);
        break;
      case "artist":
      case "channel":
        this.set_artist(item);
        break;
      case "library-artist":
        this.set_library_artist(item);
        break;
      case "song":
        this.set_song(item);
        break;
      case "video":
        this.set_video(item);
        break;
      case "playlist":
        this.set_playlist(item);
        break;
      case "watch-playlist":
        this.set_watch_playlist(item);
        break;
      default:
        console.error(`Couldn't show mixeditem of type ${item.type} in list`);
    }
  }
}
