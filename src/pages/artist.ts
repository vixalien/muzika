import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import {
  Artist,
  Category,
  get_artist,
  MixedItem,
  PlaylistItem,
} from "../muse.js";

import { ArtistHeader } from "../components/artistheader.js";
import { Carousel } from "../components/carousel.js";
import { PlaylistItemCard } from "../components/playlist/item.js";

export class ArtistPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "ArtistPage",
      Template: "resource:///com/vixalien/muzika/pages/artist.ui",
      InternalChildren: [
        "inner_box",
        "content",
        "scrolled",
      ],
    }, this);
  }

  artist?: Artist;

  _inner_box!: Gtk.Box;
  _content!: Gtk.Box;
  _scrolled!: Gtk.ScrolledWindow;

  header: ArtistHeader;
  top_songs!: Gtk.Box;
  top_songs_box!: Gtk.ListBox;

  prepare_top_songs() {
    this.top_songs = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
    });

    const top_label = new Gtk.Label({
      label: "Top Songs",
      halign: Gtk.Align.START,
      xalign: 0,
      css_classes: ["title-3"],
    });

    this.top_songs_box = new Gtk.ListBox({
      css_classes: ["background"],
    });

    this.top_songs.append(top_label);
    this.top_songs.append(this.top_songs_box);
  }

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.header = new ArtistHeader();

    this.prepare_top_songs();

    this._inner_box.append(this.header);
    this._inner_box.append(this.top_songs);
  }

  append_top_songs(tracks: PlaylistItem[]) {
    if (tracks && tracks.length > 0) {
      for (const track of tracks) {
        const card = new PlaylistItemCard();

        card.set_item(track);

        this.top_songs_box.append(card);
      }
    } else {
      this.top_songs.visible = false;
    }
  }

  set_artist(artist: Artist) {
    if (artist.thumbnails) this.header.load_thumbnails(artist.thumbnails);
    this.header.set_title(artist.name);
    this.header.set_description(artist.description);

    this.append_top_songs(artist.songs.results);

    this.add_carousel("Albums", artist.albums);
    this.add_carousel("Singles", artist.singles);
    this.add_carousel("Videos", artist.videos);
    this.add_carousel("From your library", artist.library);
    // this.add_carousel("Featured on", artist.featured);
    this.add_carousel("Playlists", artist.playlists);
    this.add_carousel("Fans might also like", artist.related);
  }

  add_carousel(title: string, data: Category<MixedItem>) {
    if (!data || data.results.length === 0) return;

    const carousel = new Carousel();

    carousel.show_content({
      title,
      contents: data.results,
    });

    this._inner_box.append(carousel);
  }

  load_artist(id: string, signal?: AbortSignal) {
    return get_artist(id, { signal })
      .then((artist) => {
        this.artist = artist;

        this.set_artist(this.artist);
      }).catch((err) => {
        console.error(err);
      });
  }
}
