import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Artist, get_artist } from "../muse.js";
import { ArtistHeader } from "./artistheader.js";

export class ArtistPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "ArtistPage",
    }, this);
  }

  header: ArtistHeader;

  artist?: Artist;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.header = new ArtistHeader();

    this.append(this.header);
  }

  set_artist(artist: Artist) {
    this.header.load_thumbnails(artist.thumbnails);
    this.header.set_title(artist.name);
    this.header.set_description(artist.description);
  }

  load_artist(id: string) {
    return get_artist(id)
      .then((artist) => {
        this.artist = artist;

        this.set_artist(this.artist);
      }).catch((err) => {
        console.error(err);
      });
  }
}
