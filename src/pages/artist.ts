import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { Artist, Category, get_artist, MixedItem } from "../muse.js";

import { ArtistHeader } from "../components/artistheader.js";
import { Carousel } from "../components/carousel/index.js";
import { PlaylistItemCard } from "../components/playlist/item.js";
import { DynamicImageState } from "src/components/dynamic-image.js";

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
        "more_top_songs",
      ],
    }, this);
  }

  artist?: Artist;

  _inner_box!: Gtk.Box;
  _content!: Gtk.Box;
  _scrolled!: Gtk.ScrolledWindow;
  _top_songs!: Gtk.Box;
  _top_songs_list!: Gtk.Box;
  _more_top_songs!: Gtk.Button;

  header: ArtistHeader;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.header = new ArtistHeader();

    this._inner_box.prepend(this.header);

    this._top_songs_list.connect(
      "row-activated",
      (_, row: PlaylistItemCard) => {
        if (
          !(row instanceof PlaylistItemCard) || !this.artist || !row.item
        ) {
          return;
        }

        row.dynamic_image.state = DynamicImageState.LOADING;

        row.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${this.artist.songs.browseId}?video=${row.item.videoId}`,
          ),
        );
      },
    );
  }

  show_top_songs(songs: Artist["songs"]) {
    if (songs.results && songs.results.length > 0) {
      for (const track of songs.results) {
        const card = new PlaylistItemCard();

        card.dynamic_image.connect("play", () => {
          this._top_songs_list.select_row(card);
        });

        card.dynamic_image.connect("pause", () => {
          this._top_songs_list.select_row(card);
        });

        card.set_item(track, songs.browseId ?? undefined);

        this._top_songs_list.append(card);
      }
    } else {
      this._top_songs.visible = false;
    }

    if (songs.browseId) {
      this._more_top_songs.visible = true;
      this._more_top_songs.action_name = "navigator.visit";
      this._more_top_songs.action_target = GLib.Variant.new(
        "s",
        `muzika:playlist:${songs.browseId}`,
      );
    }
  }

  set_artist(artist: Artist) {
    if (artist.thumbnails) this.header.load_thumbnails(artist.thumbnails);
    this.header.set_title(artist.name);
    this.header.set_description(artist.description);

    this.show_top_songs(artist.songs);

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
