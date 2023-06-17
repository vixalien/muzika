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

export class TopResultCard extends Adw.Bin {
  static {
    GObject.registerClass({
      GTypeName: "TopResult",
      Template:
        "resource:///com/vixalien/muzika/ui/components/search/topresult.ui",
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
        "image_stack",
        "actions",
        "meta",
        "grid",
        "breakpoint",
      ],
    }, this);
  }

  private _avatar!: Adw.Avatar;
  private _image!: Gtk.Image;
  private _image_overlay!: Gtk.Overlay;
  private _title!: Gtk.Label;
  private _explicit!: Gtk.Label;
  private _label_box!: Gtk.Box;
  private _type!: Gtk.Label;
  private _type_box!: Gtk.Box;
  private _second_line!: Gtk.Box;
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
  add_subsequent_middots = false;

  result?: TopResult;

  constructor() {
    super();

    const click = new Gtk.GestureClick();
    click.connect("pressed", () => {
      this.on_click();
    });
    this.add_controller(click);

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

  on_click() {
    if (!(this.result)) return;

    let uri: string | null = null;

    switch (this.result.type) {
      case "artist":
        uri = `artist:${this.result.browseId}`;
        break;
      case "album":
        uri = `album:${this.result.browseId}`;
        break;
      case "song":
      case "video":
        this.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(
            this.result.videoId,
          ),
        );
        break;
    }

    if (uri) {
      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string("muzika:" + uri),
      );
    }
  }

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
    const label = Gtk.Label.new(text);

    label.add_css_class("dim-label");

    this._label_box.append(label);
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

    this._primary.action_name = "queue.play-song";
    this._primary.action_target = GLib.Variant.new_string(track.videoId);

    this._secondary.sensitive = false;
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

    this._primary.sensitive = false;
    this._secondary.sensitive = false;
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

    this._primary_content.label = "Shuffle";
    this._primary_content.icon_name = "media-playlist-shuffle-symbolic";

    if (artist.shuffleId) {
      this._primary.sensitive = true;
      this._primary.action_name = "queue.play-playlist";
      this._primary.action_target = GLib.Variant.new_string(artist.shuffleId);
    } else {
      this._primary.sensitive = false;
    }

    this._secondary_content.label = "Radio";
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
