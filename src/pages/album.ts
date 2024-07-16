import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { get_album } from "libmuse";
import type { AlbumResult, ParsedAlbum, PlaylistItem } from "libmuse";

import { Carousel } from "../components/carousel/index.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";
import { PlaylistHeader } from "src/components/playlist/header.js";

GObject.type_ensure(PlaylistHeader.$gtype);
GObject.type_ensure(PlaylistItemView.$gtype);

interface AlbumProps {
  album: AlbumResult;
  track?: string;
}

interface AlbumState extends VScrollState, AlbumProps {}

export class AlbumPage
  extends Adw.Bin
  implements MuzikaPageWidget<AlbumProps, AlbumState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "AlbumPage",
        Template: "resource:///com/vixalien/muzika/ui/pages/album.ui",
        InternalChildren: [
          "trackCount",
          "duration",
          "insights_clamp",
          "insights",
          "playlist_item_view",
          "header",
          "menu",
          "scrolled",
          "play_button",
          "shuffle_button",
        ],
      },
      this,
    );
  }

  album?: AlbumResult;

  private _trackCount!: Gtk.Label;
  private _duration!: Gtk.Label;
  private _insights_clamp!: Adw.Clamp;
  private _insights!: Gtk.Box;
  private _playlist_item_view!: PlaylistItemView;
  private _header!: PlaylistHeader;
  private _menu!: Gtk.MenuButton;
  private _scrolled!: Gtk.ScrolledWindow;
  private _play_button!: Gtk.Button;
  private _shuffle_button!: Gtk.Button;

  track: string | null = null;

  model = new PlayableList();

  constructor() {
    super();

    this._playlist_item_view.model = Gtk.MultiSelection.new(this.model);
  }

  append_tracks(tracks: PlaylistItem[]) {
    const n = this.model.get_n_items();

    this.model.splice(
      n > 0 ? n - 1 : 0,
      0,
      tracks.map((track) => PlayableContainer.new_from_playlist_item(track)),
    );

    if (this.track) {
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].videoId == this.track) {
          this._playlist_item_view.select_track(i + n);
          break;
        }
      }
    }
  }

  show_other_versions(related: ParsedAlbum[]) {
    const carousel = new Carousel();

    carousel.show_content({
      title: _("Other versions"),
      contents: related,
    });

    this._insights.append(carousel);
  }

  present({ album, track }: AlbumProps) {
    this.model.remove_all();

    this.track = track ?? null;
    this.album = album;

    this._playlist_item_view.playlist_id = album.audioPlaylistId ?? undefined;
    this._playlist_item_view.show_artists = album.tracks.some(
      (track) => track.artists.length > 0,
    );

    this._header.load_thumbnails(album.thumbnails);
    this._header.set_description(album.description);
    this._header.set_title(album.title);
    this._header.set_explicit(album.isExplicit);
    this._header.set_genre(album.album_type);
    this._header.set_year(album.year ?? _("Unknown year"));

    this.setup_menu();

    if (album.artists && album.artists.length > 0) {
      this._header.set_subtitle(album.artists);
    }

    this._trackCount.set_label(
      (album.trackCount ?? album.tracks.length).toString(),
    );

    if (album.duration) {
      this._duration.set_label(album.duration);
    } else if (album.duration_seconds) {
      this._duration.set_label(secondsToDuration(album.duration_seconds));
    } else {
      this._duration.set_visible(false);
    }

    if (album.other_versions && album.other_versions.length > 0) {
      this._insights_clamp.visible = true;
      this.show_other_versions(album.other_versions);
    }

    this._play_button.visible = album.audioPlaylistId != null;
    if (album.audioPlaylistId) {
      this._play_button.action_target = GLib.Variant.new_string(
        `${album.audioPlaylistId}`,
      );
    }

    this._shuffle_button.visible = album.shuffleId != null;
    if (album.shuffleId) {
      this._shuffle_button.action_target = GLib.Variant.new_string(
        `${album.shuffleId}`,
      );
    }

    this.append_tracks(album.tracks);
  }

  private setup_menu() {
    if (!this.album) return;

    const menu = Gio.Menu.new();

    menu.append(
      _("Start Radio"),
      `queue.play-playlist("${this.album.audioPlaylistId}?radio=true")`,
    );
    menu.append(
      _("Play Next"),
      `queue.add-playlist("${this.album.audioPlaylistId}?next=true")`,
    );
    menu.append(
      _("Add to queue"),
      `queue.add-playlist("${this.album.audioPlaylistId}")`,
    );

    if (this.album.artists && this.album.artists.length == 0) {
      menu.append(
        _("Go to artist"),
        `navigator.visit("muzika:artist:${this.album.artists[0].id}")`,
      );
    } else {
      const section = Gio.Menu.new();

      this.album.artists.forEach((artist) => {
        section.append(
          artist.name,
          `navigator.visit("muzika:artist:${artist.id}")`,
        );
      });

      menu.append_section(_("Artists"), section);
    }

    const share_section = Gio.Menu.new();

    share_section.append(
      _("Copy Link"),
      `win.copy-url("https://music.youtube.com/playlist?list=${this.album.audioPlaylistId}")`,
    );

    menu.append_section(null, share_section);

    this._menu.menu_model = menu;
  }

  no_more = false;

  static async load(context: PageLoadContext) {
    const album = await get_album(context.match.params.albumId, {
      signal: context.signal,
    });

    context.set_title(album.title);

    return { album, track: context.url.searchParams.get("track") };
  }

  get_state(): AlbumState {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      album: this.album!,
      track: this.track ?? undefined,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: AlbumState) {
    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
    this.present({ album: state.album, track: state.track });
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
