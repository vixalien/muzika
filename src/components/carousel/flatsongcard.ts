import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { ArtistRun, FlatSong } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { DynamicImage } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";

export class FlatSongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "FlatSongCard",
      Template:
        "resource:///com/vixalien/muzika/ui/components/carousel/flatsong.ui",
      InternalChildren: [
        "title",
        "explicit",
        "second-line",
        "dynamic_image",
      ],
    }, this);
  }

  song?: FlatSong;

  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _second_line!: Gtk.Box;
  _dynamic_image!: DynamicImage;

  constructor() {
    super();
  }

  add_subsequent_middots = false;

  insert_middot(force = false) {
    const label = Gtk.Label.new("·");

    label.add_css_class("dim-label");

    const flowchild = new Gtk.FlowBoxChild({
      halign: Gtk.Align.START,
      child: label,
    });

    if (this.add_subsequent_middots || force) {
      this._second_line.append(flowchild);
    } else {
      this.add_subsequent_middots = true;
    }
  }

  add_artist_only(artist: ArtistRun) {
    let child: Gtk.Widget;

    if (artist.id) {
      const button = new Gtk.Button({
        label: artist.name,
        cursor: Gdk.Cursor.new_from_name("pointer", null),
      });

      button.add_css_class("inline");
      button.add_css_class("flat");
      button.add_css_class("link");
      button.add_css_class("dim-label");

      button.action_name = "navigator.visit";
      button.action_target = GLib.Variant.new(
        "s",
        `muzika:artist:${artist.id}`,
      );

      child = button;
    } else {
      const label = Gtk.Label.new(artist.name);

      label.add_css_class("dim-label");

      child = label;
    }

    const flowchild = new Gtk.FlowBoxChild({
      halign: Gtk.Align.START,
      child: child,
    });

    flowchild.add_css_class("no-padding");

    this._second_line.append(flowchild);
  }

  add_artist(artist: ArtistRun) {
    this.insert_middot();
    this.add_artist_only(artist);
  }

  set_song(song: FlatSong) {
    this.song = song;

    this._title.tooltip_text = this._title.label = song.title;

    if (song.artists && song.artists.length > 0) {
      song.artists.map((artist) => {
        this.add_artist(artist);
      });
    }

    this._explicit.set_visible(song.isExplicit);

    load_thumbnails(this._dynamic_image.image, song.thumbnails, 160);

    if (song.videoId) {
      this._dynamic_image.setup_video(song.videoId);
    } else {
      this._dynamic_image.reset_listeners();
    }
  }
}
