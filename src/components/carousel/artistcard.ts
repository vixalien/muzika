import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { RelatedArtist } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";
import { ParsedLibraryArtist } from "libmuse/types/parsers/library.js";

export class ArtistCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "ArtistCard",
      Template:
        "resource:///com/vixalien/muzika/components/carousel/artistcard.ui",
      InternalChildren: [
        "avatar",
        "title",
        "subtitle",
      ],
    }, this);
  }

  artist?: RelatedArtist | ParsedLibraryArtist;

  _avatar!: Adw.Avatar;
  _title!: Gtk.Label;
  _subtitle!: Gtk.Label;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });
  }

  set_artist(artist: RelatedArtist) {
    this.artist = artist;

    this._title.set_label(artist.name);
    this._subtitle.set_label(artist.subscribers ?? "");
    this._avatar.set_name(artist.name);

    load_thumbnails(this._avatar, artist.thumbnails, {
      width: 160,
      upscale: true,
    });
  }

  set_library_artist(artist: ParsedLibraryArtist) {
    this.artist = artist;

    this._title.set_label(artist.name);

    if (artist.subscribers) {
      this._subtitle.set_label(artist.subscribers);
    } else if (artist.songs) {
      this._subtitle.set_label(artist.songs);
    }

    this._avatar.set_name(artist.name);

    load_thumbnails(this._avatar, artist.thumbnails, {
      width: 160,
      upscale: true,
    });
  }
}
