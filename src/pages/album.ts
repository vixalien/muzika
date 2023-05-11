import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { AlbumResult, get_album, ParsedAlbum, PlaylistItem } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { AlbumHeader } from "../components/album/header.js";
import { AlbumItemCard } from "../components/album/item.js";

export class AlbumPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "AlbumPage",
      Template: "resource:///com/vixalien/muzika/pages/album.ui",
      InternalChildren: [
        "inner_box",
        "trackCount",
        "duration",
        "content",
        "scrolled",
      ],
    }, this);
  }

  album?: AlbumResult;

  _inner_box!: Gtk.Box;
  _trackCount!: Gtk.Label;
  _duration!: Gtk.Label;
  _content!: Gtk.Box;
  _scrolled!: Gtk.ScrolledWindow;

  list_box: Gtk.ListBox;
  header: AlbumHeader;

  _loading: Loading;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.header = new AlbumHeader();

    this.list_box = Gtk.ListBox.new();
    this.list_box.add_css_class("background");

    this._loading = new Loading();

    this._inner_box.prepend(this.header);
    this._content.append(this.list_box);
    this._content.append(this._loading);

    this._content.set_orientation(Gtk.Orientation.VERTICAL);
  }

  append_tracks(tracks: PlaylistItem[]) {
    tracks.forEach((track, index) => {
      const card = new AlbumItemCard();

      card.set_item(index + 1, track);

      this.list_box.append(card);
    });
  }

  show_other_versions(related: ParsedAlbum[]) {
    const carousel = new Carousel({
      margin_top: 24,
    });

    carousel.show_content({
      title: "Other versions",
      contents: related,
    });

    this._content.append(carousel);
  }

  show_album(album: AlbumResult) {
    this._loading.loading = false;

    this.header.load_thumbnails(album.thumbnails);
    this.header.set_description(album.description);
    this.header.set_title(album.title);
    this.header.set_explicit(album.isExplicit);
    this.header.set_genre(album.album_type);
    this.header.set_year(album.year ?? "Unknown year");

    if (album.artists && album.artists.length > 0) {
      album.artists.forEach((artist) => {
        this.header.add_author({
          name: artist.name,
          id: artist.id,
          artist: true,
        });
      });
    }

    this._trackCount.set_label(
      (album.trackCount ?? album.tracks.length).toString() + " songs",
    );
    if (album.duration_seconds) {
      this._duration.set_label(secondsToDuration(album.duration_seconds));
    }

    if (album.other_versions && album.other_versions.length > 0) {
      this.show_other_versions(album.other_versions);
    }

    this.append_tracks(album.tracks);
  }

  async load_album(channelId: string, signal?: AbortSignal) {
    this._loading.loading = true;

    this.album = await get_album(channelId, {
      signal,
    });
    this.show_album(this.album);
  }

  no_more = false;

  get isLoading() {
    return this._loading.loading;
  }

  set isLoading(value: boolean) {
    this._loading.loading = value;
  }
}

function secondsToDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const secondsStr = (seconds % 60).toString().padStart(2, "0");
  const minutesStr = (minutes % 60).toString().padStart(2, "0");
  const hoursStr = hours.toString().padStart(2, "0");

  return `${hoursStr}:${minutesStr}:${secondsStr}`;
}
