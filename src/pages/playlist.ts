import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import {
  get_more_playlist_tracks,
  get_playlist,
  ParsedPlaylist,
  Playlist,
  PlaylistItem,
} from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { PlaylistHeader } from "../components/playlist/header.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { ObjectContainer } from "src/util/objectcontainer.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { Paginator } from "src/components/paginator.js";

interface PlaylistState {
  playlist: Playlist;
}

Paginator;
PlaylistHeader;
PlaylistItemView;

export class PlaylistPage extends Adw.Bin
  implements MuzikaComponent<Playlist, PlaylistState> {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/playlist.ui",
      InternalChildren: [
        "breakpoint",
        "inner_box",
        "trackCount",
        "separator",
        "duration",
        "content",
        "scrolled",
        "data",
        "playlist_item_view",
        "paginator",
        "header",
      ],
    }, this);
  }

  playlist?: Playlist;

  private _breakpoint!: Adw.Breakpoint;
  private _inner_box!: Gtk.Box;
  private _trackCount!: Gtk.Label;
  private _duration!: Gtk.Label;
  private _content!: Gtk.Box;
  private _separator!: Gtk.Label;
  private _scrolled!: Gtk.ScrolledWindow;
  private _data!: Gtk.Box;
  private _playlist_item_view!: PlaylistItemView;
  private _paginator!: Paginator;
  private _header!: PlaylistHeader;

  model = new Gio.ListStore<ObjectContainer<PlaylistItem>>({
    item_type: ObjectContainer.$gtype,
  });

  constructor() {
    super();

    this._scrolled.connect("edge-reached", (_, pos) => {
      if (pos === Gtk.PositionType.BOTTOM) {
        this.load_more();
      }
    });

    this._playlist_item_view.model = this.model;

    this._paginator.connect("activate", () => {
      this.load_more();
    });

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

  show_related(related: ParsedPlaylist[]) {
    const carousel = new Carousel({
      margin_top: 24,
    });

    carousel.show_content({
      title: _("Related playlists"),
      contents: related,
    });

    this._content.append(carousel);
  }

  present(playlist: Playlist) {
    this.model.remove_all();

    this.playlist = playlist;
    this._playlist_item_view.playlistId = playlist.id;

    this._playlist_item_view.show_rank = playlist.tracks[0].rank != null;

    this._header.load_thumbnails(playlist.thumbnails);
    this._header.set_description(playlist.description);
    this._header.set_title(playlist.title);
    this._header.set_explicit(false);
    this._header.set_genre(playlist.type);
    this._header.set_year(playlist.year);

    if (playlist.authors && playlist.authors.length >= 1) {
      playlist.authors.forEach((author) => {
        this._header.add_author({
          ...author,
          // can only be an artist when we are viewing the playlist of
          // all songs by an artist
          artist: playlist.id.startsWith("OLAK5uy_"),
        });
      });
    }

    if (playlist.trackCount) {
      this._trackCount.set_label(playlist.trackCount.toString() + " songs");
    } else {
      this._trackCount.set_visible(false);
      this._separator.set_visible(false);
    }

    if (playlist.duration) {
      this._duration.set_label(playlist.duration);
    } else {
      this._duration.set_visible(false);
      this._separator.set_visible(false);
    }

    if (!playlist.duration && !playlist.trackCount) {
      this._data.set_visible(false);
    }

    if (playlist.related && playlist.related.length > 0) {
      this.show_related(playlist.related);
    }

    this._paginator.can_paginate = this.playlist.continuation != null;

    this.append_tracks(playlist.tracks);
  }

  no_more = false;

  get isLoading() {
    return this._paginator.loading;
  }

  set isLoading(value: boolean) {
    this._paginator.loading = value;
  }

  async load_more() {
    if (this.isLoading || this.no_more) return;
    this.isLoading = true;

    if (!this.playlist) return;

    if (this.playlist.continuation) {
      const more = await get_more_playlist_tracks(
        this.playlist.id,
        this.playlist.continuation,
        {
          limit: 100,
        },
      );

      this.isLoading = false;

      this.playlist.continuation = more.continuation;
      this._paginator.can_paginate = more.continuation != null;
      this.playlist.tracks.push(...more.tracks);

      this.append_tracks(more.tracks);
    } else {
      this.isLoading = false;
      this.no_more = true;
    }
  }

  static load(context: EndpointContext) {
    return get_playlist(context.match.params.playlistId, {
      related: true,
      signal: context.signal,
    });
  }

  get_state(): PlaylistState {
    return {
      playlist: this.playlist!,
    };
  }

  restore_state(state: PlaylistState) {
    this.present(state.playlist);
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
