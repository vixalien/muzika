import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import {
  ArtistRun,
  SearchAlbum,
  SearchArtist,
  SearchContent,
  SearchPlaylist,
  SearchRadio,
  SearchSong,
  SearchVideo,
} from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

export class InlineCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "InlineCard",
      Template:
        "resource:///com/vixalien/muzika/components/search/inlinecard.ui",
      InternalChildren: [
        "avatar",
        "image",
        "image_overlay",
        "title",
        "explicit",
        "label_box",
        "type",
        "type_box",
        "type_separator",
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
  _type_separator!: Gtk.Label;

  image_size = 48;
  add_subsequent_middots = false;

  content?: SearchContent;

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
    this._type_separator.visible = true;
    this._label_box.append(Gtk.Label.new(text));
  }

  insert_text(text: string) {
    this.insert_middot();
    this.insert_only_text(text);
  }

  add_artist_only(artist: ArtistRun) {
    this._type_separator.visible = true;
    let child: Gtk.Widget;

    if (artist.id) {
      const button = new Gtk.Button({ label: artist.name });

      button.add_css_class("inline");
      button.add_css_class("flat");
      button.add_css_class("link");

      button.action_name = "navigator.visit";
      button.action_target = GLib.Variant.new(
        "s",
        `muzika:artist:${artist.id}`,
      );

      child = button;
    } else {
      const label = Gtk.Label.new(artist.name);

      child = label;
    }

    const flowchild = new Gtk.FlowBoxChild({
      halign: Gtk.Align.START,
      child: child,
    });

    flowchild.add_css_class("no-padding");

    this._label_box.append(flowchild);
  }

  add_artist(artist: ArtistRun) {
    this.insert_middot();
    this.add_artist_only(artist);
  }

  private set_song_or_video(track: SearchSong | SearchVideo) {
    this.content = track;

    load_thumbnails(this._image, track.thumbnails, this.image_size);

    this._title.label = track.title;
    this._explicit.set_visible(track.isExplicit);

    track.artists.forEach((artist) => {
      this.add_artist(artist);
    });

    if (track.duration) this.insert_text(track.duration);
  }

  set_song(song: SearchSong) {
    this.set_song_or_video(song);
    this._type.label = "Song";
  }

  set_video(video: SearchVideo) {
    // this._image.width_request = 85.5;
    this.set_song_or_video(video);
    this._type.label = "Video";
  }

  set_album(album: SearchAlbum) {
    this.content = album;

    load_thumbnails(this._image, album.thumbnails, this.image_size);

    this._title.label = album.title;
    this._explicit.set_visible(album.isExplicit);

    this._type.label = album.album_type;

    this.show_type(true);

    album.artists.forEach((artist) => {
      this.add_artist(artist);
    });
  }

  set_playlist(playlist: SearchPlaylist) {
    this.content = playlist;

    load_thumbnails(this._image, playlist.thumbnails, this.image_size);

    this._title.label = playlist.title;

    this._type.label = "Playlist";

    playlist.authors.forEach((artist) => {
      this.add_artist(artist);
    });
  }

  set_artist(artist: SearchArtist) {
    this.content = artist;

    this.show_avatar(true);
    load_thumbnails(this._avatar, artist.thumbnails, this.image_size);

    this._title.label = artist.name;

    this.show_type(false);

    if (artist.subscribers) {
      this.insert_only_text(`${artist.subscribers} subscribers`);
    }
  }

  set_radio(radio: SearchRadio) {
    this.content = radio;

    load_thumbnails(this._image, radio.thumbnails, this.image_size);

    this._title.label = radio.title;

    this._type.label = "Radio";

    this.show_type(true);
  }
}
