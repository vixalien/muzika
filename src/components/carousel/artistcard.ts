import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { RelatedArtist } from "../../muse.js";
import { load_thumbnails } from "../webimage.js";

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

  artist?: RelatedArtist;

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

    load_thumbnails(this._avatar, artist.thumbnails, 160);
  }
}
