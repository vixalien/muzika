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
import { Carousel } from "../components/carousel/index.js";
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
        "top_songs_list",
        "top_songs",
      ],
    }, this);
  }

  artist?: Artist;

  _inner_box!: Gtk.Box;
  _content!: Gtk.Box;
  _scrolled!: Gtk.ScrolledWindow;
  _top_songs!: Gtk.Box;
  _top_songs_list!: Gtk.ListBox;

  header: ArtistHeader;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.header = new ArtistHeader();

    this._inner_box.prepend(this.header);
  }

  append_top_songs(tracks: PlaylistItem[]) {
    if (tracks && tracks.length > 0) {
      for (const track of tracks) {
        const card = new PlaylistItemCard();

        card.set_item(track);

        this._top_songs_list.append(card);
      }
    } else {
      this._top_songs.visible = false;
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
    this.add_carousel("Featured on", artist.featured);
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
      });
  }
}
