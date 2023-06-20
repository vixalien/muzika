import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { AlbumResult, get_album, ParsedAlbum, PlaylistItem } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { AlbumHeader } from "../components/album/header.js";
import { AlbumItemCard } from "../components/album/item.js";
import { DynamicImageState } from "src/components/dynamic-image.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";

interface AlbumState {
  album: AlbumResult;
}

export class AlbumPage extends Gtk.Box
  implements MuzikaComponent<AlbumResult, AlbumState> {
  static {
    GObject.registerClass({
      GTypeName: "AlbumPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/album.ui",
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

    this.list_box = new Gtk.ListBox();
    this.list_box.add_css_class("background");

    this._loading = new Loading();

    this._inner_box.prepend(this.header);
    this._content.append(this.list_box);
    this._content.append(this._loading);

    this._content.set_orientation(Gtk.Orientation.VERTICAL);

    this.list_box.connect("row-activated", (_, row: AlbumItemCard) => {
      if (
        !(row instanceof AlbumItemCard) || !this.album?.audioPlaylistId ||
        !row.item
      ) {
        return;
      }

      row.dynamic_image.state = DynamicImageState.LOADING;

      row.activate_action(
        "queue.play-playlist",
        GLib.Variant.new_string(
          `${this.album.audioPlaylistId}?video=${row.item.videoId}`,
        ),
      );
    });
  }

  append_tracks(tracks: PlaylistItem[]) {
    tracks.forEach((track, index) => {
      const card = new AlbumItemCard();

      card.dynamic_image.connect("play", () => {
        this.list_box.select_row(card);
      });

      card.dynamic_image.connect("pause", () => {
        this.list_box.select_row(card);
      });

      card.set_item(index + 1, track, this.album?.audioPlaylistId ?? undefined);

      this.list_box.append(card);
    });
  }

  show_other_versions(related: ParsedAlbum[]) {
    const carousel = new Carousel({
      margin_top: 24,
    });

    carousel.show_content({
      title: _("Other versions"),
      contents: related,
    });

    this._content.append(carousel);
  }

  present(album: AlbumResult) {
    this.album = album;
    this._loading.loading = false;

    this.header.load_thumbnails(album.thumbnails);
    this.header.set_description(album.description);
    this.header.set_title(album.title);
    this.header.set_explicit(album.isExplicit);
    this.header.set_genre(album.album_type);
    this.header.set_year(album.year ?? _("Unknown year"));

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

  no_more = false;

  get isLoading() {
    return this._loading.loading;
  }

  set isLoading(value: boolean) {
    this._loading.loading = value;
  }

  static load(context: EndpointContext) {
    return get_album(context.match.params.albumId, {
      signal: context.signal,
    });
  }

  get_state(): AlbumState {
    return {
      album: this.album!,
    };
  }

  restore_state(state: AlbumState) {
    this.present(state.album);
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
