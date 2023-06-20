import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import {
  get_more_playlist_tracks,
  get_playlist,
  ParsedPlaylist,
  Playlist,
  PlaylistItem,
} from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { Loading } from "../components/loading.js";
import { PlaylistHeader } from "../components/playlist/header.js";
import { PlaylistItemCard } from "../components/playlist/item.js";
import { DynamicImageState } from "src/components/dynamic-image.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";

interface PlaylistState {
  playlist: Playlist;
}

export class PlaylistPage extends Gtk.Box
  implements MuzikaComponent<Playlist, PlaylistState> {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/playlist.ui",
      InternalChildren: [
        "inner_box",
        "trackCount",
        "separator",
        "duration",
        "content",
        "scrolled",
        "data",
        "list_box",
      ],
    }, this);
  }

  playlist?: Playlist;

  _inner_box!: Gtk.Box;
  _trackCount!: Gtk.Label;
  _duration!: Gtk.Label;
  _content!: Gtk.Box;
  _separator!: Gtk.Label;
  _scrolled!: Gtk.ScrolledWindow;
  _data!: Gtk.Box;
  _list_box!: Gtk.ListBox;

  header: PlaylistHeader;

  _loading: Loading;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.header = new PlaylistHeader();

    this._loading = new Loading();

    this._inner_box.prepend(this.header);
    this._content.append(this._loading);

    this._content.set_orientation(Gtk.Orientation.VERTICAL);

    this._scrolled.connect("edge-reached", (_, pos) => {
      if (pos === Gtk.PositionType.BOTTOM) {
        this.load_more();
      }
    });

    this._list_box.connect("row-activated", (_, row: PlaylistItemCard) => {
      if (!(row instanceof PlaylistItemCard) || !this.playlist || !row.item) {
        return;
      }

      row.dynamic_image.state = DynamicImageState.LOADING;

      row.activate_action(
        "queue.play-playlist",
        GLib.Variant.new_string(
          `${this.playlist!.id}?video=${row.item.videoId}`,
        ),
      );
    });
  }

  append_tracks(tracks: PlaylistItem[]) {
    for (const track of tracks) {
      const card = new PlaylistItemCard();

      card.dynamic_image.connect("play", () => {
        this._list_box.select_row(card);
      });

      card.dynamic_image.connect("pause", () => {
        this._list_box.select_row(card);
      });

      this._list_box.append(card);

      card.set_item(track, this.playlist?.id);
    }
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
    this.playlist = playlist;

    this._loading.loading = false;

    // this.clear_box();

    this.header.load_thumbnails(playlist.thumbnails);
    this.header.set_description(playlist.description);
    this.header.set_title(playlist.title);
    this.header.set_explicit(false);
    this.header.set_genre(playlist.type);
    this.header.set_year(playlist.year);

    if (playlist.authors && playlist.authors.length >= 1) {
      playlist.authors.forEach((author) => {
        this.header.add_author({
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

    this.append_tracks(playlist.tracks);
  }

  no_more = false;

  get isLoading() {
    return this._loading.loading;
  }

  set isLoading(value: boolean) {
    this._loading.loading = value;
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
