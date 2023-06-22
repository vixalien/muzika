import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { AlbumResult, get_album, ParsedAlbum, PlaylistItem } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { AlbumHeader } from "../components/album/header.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { ObjectContainer } from "src/util/objectcontainer.js";

interface AlbumState {
  album: AlbumResult;
}

AlbumHeader;
PlaylistItemView;

export class AlbumPage extends Adw.Bin
  implements MuzikaComponent<AlbumResult, AlbumState> {
  static {
    GObject.registerClass({
      GTypeName: "AlbumPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/album.ui",
      InternalChildren: [
        "breakpoint",
        "inner_box",
        "trackCount",
        "duration",
        "content",
        "scrolled",
        "playlist_item_view",
        "header",
      ],
    }, this);
  }

  album?: AlbumResult;

  private _breakpoint!: Adw.Breakpoint;
  private _trackCount!: Gtk.Label;
  private _duration!: Gtk.Label;
  private _content!: Gtk.Box;
  private _playlist_item_view!: PlaylistItemView;
  private _header!: AlbumHeader;

  model = new Gio.ListStore<ObjectContainer<PlaylistItem>>({
    item_type: ObjectContainer.$gtype,
  });

  constructor() {
    super();

    this._playlist_item_view.model = this.model;

    this._breakpoint.connect("apply", () => {
      this._playlist_item_view.show_column = true;
      this._header.show_large_header = true;
    });

    this._breakpoint.connect("unapply", () => {
      this._playlist_item_view.show_column = false;
      this._header.show_large_header = false;
    });
  }

  append_tracks(tracks: PlaylistItem[]) {
    const n = this.model.get_n_items();

    this.model.splice(
      n > 0 ? n - 1 : 0,
      0,
      tracks.map((track) => ObjectContainer.new(track)),
    );
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
    this.model.remove_all();

    this.album = album;
    this._playlist_item_view.playlistId = album.audioPlaylistId ?? undefined;

    this._header.load_thumbnails(album.thumbnails);
    this._header.set_description(album.description);
    this._header.set_title(album.title);
    this._header.set_explicit(album.isExplicit);
    this._header.set_genre(album.album_type);
    this._header.set_year(album.year ?? _("Unknown year"));

    if (album.artists && album.artists.length > 0) {
      album.artists.forEach((artist) => {
        this._header.add_author({
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
