import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { Loading } from "../components/loading.js";
import { PlaylistHeader } from "../components/playlistheader.js";

import {
  get_more_playlist_tracks,
  get_playlist,
  ParsedPlaylist,
  Playlist,
  PlaylistItem,
} from "../muse.js";
import { load_thumbnails } from "../components/webimage.js";
import { Carousel } from "../components/carousel.js";

export class PlaylistPage extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistPage",
      Template: "resource:///org/example/TypescriptTemplate/pages/playlist.ui",
      InternalChildren: [
        "inner_box",
        "trackCount",
        "duration",
        "content",
        "scrolled",
      ],
    }, this);
  }

  playlist?: Playlist;

  _inner_box!: Gtk.Box;
  _trackCount!: Gtk.Label;
  _duration!: Gtk.Label;
  _content!: Gtk.Box;
  _scrolled!: Gtk.ScrolledWindow;

  list_box: Gtk.ListBox;
  header: PlaylistHeader;

  _loading: Loading;
  // _box: Gtk.Box;
  // _clamp: Adw.Clamp;
  // _scrolled: Gtk.ScrolledWindow;

  constructor() {
    super({
      orientation: Gtk.Orientation.VERTICAL,
    });

    this.header = new PlaylistHeader();

    // this._box = new Gtk.Box({
    //   orientation: Gtk.Orientation.VERTICAL,
    //   spacing: 12,
    // });

    // this._clamp = new Adw.Clamp({
    //   margin_top: 12,
    //   margin_bottom: 12,
    //   maximum_size: 1000,
    //   tightening_threshold: 800,
    // });
    // this._clamp.set_child(this._box);

    // this._scrolled = new Gtk.ScrolledWindow({ vexpand: true, hexpand: true });
    // this._scrolled.set_child(this._clamp);

    // this.append(this._scrolled);

    this.list_box = Gtk.ListBox.new();
    this.list_box.add_css_class("background");

    this._loading = new Loading();

    this._inner_box.prepend(this.header);
    this._content.append(this.list_box);
    this._content.append(this._loading);

    this._content.set_orientation(Gtk.Orientation.VERTICAL);

    this._scrolled.connect("edge-reached", (_, pos) => {
      if (pos === Gtk.PositionType.BOTTOM) {
        this.load_more();
      }
    });
  }

  // clear_box() {
  //   let child = this._box.get_first_child();

  //   while (child) {
  //     this._box.remove(child);

  //     child = this._box.get_first_child();
  //   }
  // }

  append_tracks(tracks: PlaylistItem[]) {
    for (const track of tracks) {
      const card = new PlaylistItemCard();

      card.set_item(track);

      this.list_box.append(card);
    }
  }

  show_related(related: ParsedPlaylist[]) {
    const carousel = new Carousel({
      margin_top: 24,
    });

    carousel.show_content({
      title: "Related playlists",
      contents: related,
    });

    this._content.append(carousel);
  }

  show_playlist(playlist: Playlist) {
    this._loading.loading = false;

    // this.clear_box();

    this.header.load_thumbnails(playlist.thumbnails);
    this.header.set_description(playlist.description);
    this.header.set_title(playlist.title);
    this.header.set_explicit(false);
    this.header.set_genre("Playlist");
    this.header.set_year(playlist.year ?? "Unknown year");

    if (playlist.author) {
      this.header.add_author(playlist.author);
    }

    this._trackCount.set_label(playlist.trackCount.toString() + " songs");
    this._duration.set_label(secondsToDuration(playlist.duration_seconds));

    if (playlist.related) {
      this.show_related(playlist.related);
    }

    this.append_tracks(playlist.tracks);
  }

  async load_playlist(channelId: string, signal?: AbortSignal) {
    this._loading.loading = true;

    try {
      this.playlist = await get_playlist(channelId, {
        related: true,
        signal,
      });
      this.show_playlist(this.playlist);
    } catch (e) {
      return console.error((e as any).toString());
    }
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
}

export class PlaylistItemCard extends Gtk.ListBoxRow {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistItem",
      Template:
        "resource:///org/example/TypescriptTemplate/components/playlist/playlistitem.ui",
      InternalChildren: [
        "play_button",
        "image",
        "title",
        "explicit",
        "subtitle",
        "image",
      ],
    }, this);
  }

  item?: PlaylistItem;

  _play_button!: Gtk.Button;
  _image!: Gtk.Image;
  _title!: Gtk.Label;
  _explicit!: Gtk.Image;
  _subtitle!: Gtk.Label;

  constructor() {
    super({});
  }

  set_item(item: PlaylistItem) {
    this.item = item;

    this._title.set_label(item.title);

    if (item.artists && item.artists.length > 0) {
      this._subtitle.set_label(item.artists[0].name);
    } else {
      this._subtitle.set_label("");
    }

    this._explicit.set_visible(item.isExplicit);

    load_thumbnails(this._image, item.thumbnails, 48);
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
