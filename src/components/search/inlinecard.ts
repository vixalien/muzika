import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
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
import { DynamicImage } from "../dynamic-image.js";
import { pretty_subtitles } from "src/util/text.js";

DynamicImage;

export class InlineCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "InlineCard",
      Template:
        "resource:///com/vixalien/muzika/ui/components/search/inlinecard.ui",
      InternalChildren: [
        "stack",
        "avatar",
        "title",
        "explicit",
        "subtitle",
      ],
      Children: [
        "dynamic_image",
      ],
    }, this);
  }

  constructor() {
    super();

    this._subtitle.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });
  }

  private _stack!: Gtk.Stack;
  private _avatar!: Adw.Avatar;
  private _title!: Gtk.Label;
  private _explicit!: Gtk.Label;
  private _subtitle!: Gtk.Label;

  dynamic_image!: DynamicImage;

  image_size = 48;
  add_subsequent_middots = false;

  content?: SearchContent;

  show_type = true;

  private set_subtitle(
    type: string,
    artists: Parameters<typeof pretty_subtitles>[0],
    suffix?: null | string | (string | null)[],
  ) {
    const subtitles = pretty_subtitles(artists, {
      prefix: this.show_type ? type : undefined,
      suffix: suffix ?? undefined,
    });

    this._subtitle.set_markup(subtitles.markup);
    this._subtitle.tooltip_text = subtitles.plain;
  }

  show_avatar(show: boolean) {
    this._stack.visible_child = show ? this._avatar : this.dynamic_image;
  }

  private set_song_or_video(track: SearchSong | SearchVideo) {
    this.content = track;

    this._title.label = track.title;
    this._explicit.set_visible(track.isExplicit);

    this.dynamic_image.load_thumbnails(track.thumbnails);
    this.dynamic_image.setup_video(track.videoId);
  }

  set_song(song: SearchSong) {
    this.set_song_or_video(song);

    this.set_subtitle(_("Song"), song.artists, song.duration);
  }

  set_video(video: SearchVideo) {
    // this._image.width_request = 85.5;
    this.set_song_or_video(video);

    this.set_subtitle(_("Video"), video.artists, video.duration);
  }

  set_album(album: SearchAlbum) {
    this.content = album;

    this._title.label = album.title;
    this._explicit.set_visible(album.isExplicit);

    this.show_type = true;
    this.set_subtitle(album.album_type, album.artists);

    this.dynamic_image.load_thumbnails(album.thumbnails);
  }

  set_playlist(playlist: SearchPlaylist) {
    this.content = playlist;

    this._title.label = playlist.title;

    this.set_subtitle(_("Playlist"), playlist.authors);

    this.dynamic_image.load_thumbnails(playlist.thumbnails);
    this.dynamic_image.setup_playlist(playlist.browseId);
  }

  set_artist(artist: SearchArtist) {
    this.content = artist;

    this.show_avatar(true);

    this._title.label = artist.name;

    this.show_type = false;
    this.set_subtitle(_("Artist"), [artist.subscribers]);

    load_thumbnails(this._avatar, artist.thumbnails, this.image_size);
  }

  set_radio(radio: SearchRadio) {
    this.content = radio;

    this._title.label = radio.title;

    this.show_type = true;
    this.set_subtitle(_("Radio"), []);

    this.dynamic_image.load_thumbnails(radio.thumbnails);
    this.dynamic_image.setup_playlist(radio.playlistId);
  }
}
