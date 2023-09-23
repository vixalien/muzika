import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { Artist, Category, get_artist, MixedItem } from "../muse.js";

import { Carousel } from "../components/carousel/index.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { PlaylistListView } from "src/components/playlist/listview.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import { get_square_thumbnails } from "src/components/webimage.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";
import { PlaylistHeader } from "src/components/playlist/header.js";

interface ArtistState extends VScrollState {
  artist: Artist;
}

PlaylistHeader;
PlaylistListView;

export class ArtistPage extends Adw.Bin
  implements MuzikaComponent<Artist, ArtistState> {
  static {
    GObject.registerClass({
      GTypeName: "ArtistPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/artist.ui",
      InternalChildren: [
        "top_songs",
        "more_top_songs",
        "playlist_item_view",
        "header",
        "carousels",
        "menu",
        "scrolled",
        "shuffle_button",
        "radio_button",
      ],
    }, this);
  }

  artist?: Artist;

  private _top_songs!: Gtk.Box;
  private _more_top_songs!: Gtk.Button;
  private _playlist_item_view!: PlaylistItemView;
  private _header!: PlaylistHeader;
  private _carousels!: Gtk.Box;
  private _menu!: Gtk.MenuButton;
  private _scrolled!: Gtk.ScrolledWindow;
  private _shuffle_button!: Gtk.Button;
  private _radio_button!: Gtk.Button;

  model = new PlayableList();

  constructor() {
    super();

    this._playlist_item_view.model = this.model;
  }

  show_top_songs(songs: Artist["songs"]) {
    this._playlist_item_view.playlistId = songs.browseId ?? undefined;
    this._playlist_item_view.show_artists = songs.results.some((track) =>
      track.artists.length > 0
    );
    this._playlist_item_view.show_time = songs.results.some((track) =>
      track.duration != null
    );

    if (songs.results && songs.results.length > 0) {
      this._top_songs.visible = true;
      const n = this.model.get_n_items();

      this.model.splice(
        n > 0 ? n - 1 : 0,
        0,
        songs.results.map((track) =>
          PlayableContainer.new_from_playlist_item(track)
        ),
      );
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

  present(artist: Artist) {
    this.model.remove_all();

    this.artist = artist;

    if (artist.thumbnails) {
      this._header.load_thumbnails(get_square_thumbnails(artist.thumbnails));
    }

    this._header.set_title(artist.name);
    this._header.set_description(artist.description);

    this._shuffle_button.visible = artist.shuffleId != null;
    if (artist.shuffleId) {
      this._shuffle_button.action_target = GLib.Variant.new_string(
        `${artist.shuffleId}`,
      );
    }

    this._radio_button.visible = artist.radioId != null;
    if (artist.radioId) {
      this._radio_button.action_target = GLib.Variant.new_string(
        `${artist.radioId}`,
      );
    }

    this.show_top_songs(artist.songs);

    this.add_carousel(_("Albums"), artist.albums, true);
    this.add_carousel(_("Singles"), artist.singles, true);
    this.add_carousel(_("Videos"), artist.videos);
    this.add_carousel(_("From your library"), artist.library);
    this.add_carousel(_("Featured on"), artist.featured);
    this.add_carousel(_("Playlists"), artist.playlists);
    this.add_carousel(_("Fans might also like"), artist.related);

    this.setup_menu();
  }

  private setup_menu() {
    if (!this.artist) return;

    const menu = Gio.Menu.new();

    const share_section = Gio.Menu.new();

    share_section.append(
      _("Copy Link"),
      `win.copy-url("https://music.youtube.com/channel/${this.artist.channelId}")`,
    );

    menu.append_section(null, share_section);

    this._menu.menu_model = menu;
  }

  add_carousel(
    title: string,
    data: Category<MixedItem>,
    show_more_button = false,
  ) {
    if (!data || data.results.length === 0) return;

    const carousel = new Carousel();

    carousel.setup_more_button(
      (show_more_button && data.browseId != null && data.params != null)
        ? `navigator.visit("muzika:artist-albums:${data.browseId}:${data.params}")`
        : null,
    );

    carousel.show_content({
      title,
      contents: data.results,
    });
    this._carousels.append(carousel);
  }

  static async load(context: EndpointContext) {
    const artist = await get_artist(context.match.params.channelId, {
      signal: context.signal,
    });

    context.set_title(artist.name);

    return artist;
  }

  get_state(): ArtistState {
    return {
      artist: this.artist!,
      vscroll: this._scrolled.vadjustment.value,
    };
  }

  restore_state(state: ArtistState) {
    this.present(state.artist);

    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
  }
}
