import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import {
  TopResult,
  TopResultAlbum,
  TopResultArtist,
  TopResultSong,
} from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { TopResultVideo } from "libmuse/types/parsers/search.js";
import { DynamicImage } from "../dynamic-image.js";
import { pretty_subtitles } from "src/util/text.js";

DynamicImage;

export class TopResultCard extends Gtk.FlowBoxChild {
  static {
    GObject.registerClass({
      GTypeName: "TopResult",
      Template:
        "resource:///com/vixalien/muzika/ui/components/search/topresult.ui",
      InternalChildren: [
        "avatar",
        "title",
        "explicit",
        "subtitle",
        "primary",
        "primary_content",
        "secondary",
        "secondary_content",
        "image_stack",
        "actions",
        "meta",
        "grid",
        "breakpoint",
      ],
      Children: [
        "dynamic_image",
      ],
    }, this);
  }

  private _avatar!: Adw.Avatar;
  private _title!: Gtk.Label;
  private _explicit!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _primary!: Gtk.Button;
  private _primary_content!: Adw.ButtonContent;
  private _secondary!: Gtk.Button;
  private _secondary_content!: Adw.ButtonContent;
  private _image_stack!: Gtk.Stack;
  private _actions!: Gtk.Box;
  private _meta!: Gtk.Box;
  private _grid!: Gtk.Grid;
  private _breakpoint!: Adw.Breakpoint;

  image_size = 100;
  dynamic_image!: DynamicImage;

  result?: TopResult;

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

    this._breakpoint.connect("apply", () => {
      this.small_layout();
    });

    this._breakpoint.connect("unapply", () => {
      this.large_layout();
    });
  }

  private unparent_stack_children() {
    for (const child of [this._image_stack, this._meta, this._actions]) {
      this._grid.remove(child);
    }
  }

  private small_layout() {
    this.unparent_stack_children();

    this._primary.add_css_class("compact");
    this._secondary.add_css_class("compact");

    this._grid.attach(this._image_stack, 0, 0, 1, 1);
    this._grid.attach(this._meta, 1, 0, 1, 1);
    this._grid.attach(this._actions, 0, 2, 2, 1);
  }

  private large_layout() {
    this.unparent_stack_children();

    this._primary.remove_css_class("compact");
    this._secondary.remove_css_class("compact");

    this._grid.attach(this._image_stack, 0, 0, 1, 2);
    this._grid.attach(this._meta, 1, 0, 1, 1);
    this._grid.attach(this._actions, 1, 1, 1, 1);
  }

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
    this._image_stack.visible_child = show ? this._avatar : this.dynamic_image;
  }

  private set_song_or_video(track: TopResultSong | TopResultVideo) {
    this.result = track;

    this._title.label = track.title;
    this._explicit.set_visible(track.isExplicit);

    this.dynamic_image.load_thumbnails(track.thumbnails);
    this.dynamic_image.setup_video(track.videoId);

    this._primary.action_name = "queue.play-song";
    this._primary.action_target = GLib.Variant.new_string(track.videoId);

    this._secondary.sensitive = false;
    this._secondary_content.label = _("Add");
    this._secondary_content.icon_name = "list-add-symbolic";
  }

  set_song(song: TopResultSong) {
    this.set_song_or_video(song);

    this.set_subtitle("Song", song.artists, [song.duration]);
  }

  set_video(video: TopResultVideo) {
    this.set_song_or_video(video);

    this.set_subtitle("Video", video.artists, [video.duration]);
  }

  set_album(album: TopResultAlbum) {
    this.result = album;

    this.dynamic_image.load_thumbnails(album.thumbnails);

    this._title.label = album.title;
    this._explicit.set_visible(album.isExplicit);

    this.set_subtitle(album.album_type, album.artists);

    this._primary.sensitive = false;
    this._secondary.sensitive = false;
  }

  set_artist(artist: TopResultArtist) {
    this.result = artist;

    this.show_avatar(true);
    load_thumbnails(this._avatar, artist.thumbnails, this.image_size);

    this._title.label = artist.name;

    this.set_subtitle(_("Artist"), [], `${artist.subscribers} subscribers`);

    this._primary_content.label = _("Shuffle");
    this._primary_content.icon_name = "media-playlist-shuffle-symbolic";

    if (artist.shuffleId) {
      this._primary.sensitive = true;
      this._primary.action_name = "queue.play-playlist";
      this._primary.action_target = GLib.Variant.new_string(artist.shuffleId);
    } else {
      this._primary.sensitive = false;
    }

    this._secondary_content.label = _("Radio");
    this._secondary_content.icon_name = "sonar-symbolic";

    if (artist.radioId) {
      this._secondary.sensitive = true;
      this._secondary.action_name = "queue.play-playlist";
      this._secondary.action_target = GLib.Variant.new_string(artist.radioId);
    } else {
      this._secondary.sensitive = false;
    }
  }
}
