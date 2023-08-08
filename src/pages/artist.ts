import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { Artist, Category, get_artist, MixedItem } from "../muse.js";

import { ArtistHeader } from "../components/artistheader.js";
import { Carousel } from "../components/carousel/index.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { PlaylistListView } from "src/components/playlist/listview.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";

interface ArtistState extends VScrollState {
  artist: Artist;
}

ArtistHeader;
PlaylistListView;

export class ArtistPage extends Adw.Bin
  implements MuzikaComponent<Artist, ArtistState> {
  static {
    GObject.registerClass({
      GTypeName: "ArtistPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/artist.ui",
      InternalChildren: [
        "breakpoint",
        "inner_box",
        "top_songs",
        "more_top_songs",
        "playlist_item_view",
        "header",
        "scrolled",
      ],
    }, this);
  }

  artist?: Artist;

  private _breakpoint!: Adw.Breakpoint;
  private _inner_box!: Gtk.Box;
  private _top_songs!: Gtk.Box;
  private _more_top_songs!: Gtk.Button;
  private _playlist_item_view!: PlaylistItemView;
  private _header!: ArtistHeader;
  private _scrolled!: Gtk.ScrolledWindow;

  model = new PlayableList();

  constructor() {
    super();

    this._playlist_item_view.model = this.model;

    this._breakpoint.connect("unapply", () => {
      this._playlist_item_view.show_column = true;
      this._header.show_large_header = true;
    });

    this._breakpoint.connect("apply", () => {
      this._playlist_item_view.show_column = false;
      this._header.show_large_header = false;
    });
  }

  show_top_songs(songs: Artist["songs"]) {
    this._playlist_item_view.playlistId = songs.browseId ?? undefined;

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

    if (artist.thumbnails) this._header.load_thumbnails(artist.thumbnails);

    this._header.set_title(artist.name);
    this._header.set_description(artist.description);
    this.update_header_buttons();

    this.show_top_songs(artist.songs);

    this.add_carousel(_("Albums"), artist.albums, true);
    this.add_carousel(_("Singles"), artist.singles, true);
    this.add_carousel(_("Videos"), artist.videos);
    this.add_carousel(_("From your library"), artist.library);
    this.add_carousel(_("Featured on"), artist.featured);
    this.add_carousel(_("Playlists"), artist.playlists);
    this.add_carousel(_("Fans might also like"), artist.related);
  }

  update_header_buttons() {
    if (!this.artist) return;

    this._header.clear_buttons();

    if (this.artist.shuffleId) {
      this._header.add_button({
        label: _("Shuffle"),
        icon_name: "media-playlist-shuffle-symbolic",
        action_name: "queue.play-playlist",
        action_target: GLib.Variant.new_string(
          `${this.artist.shuffleId}`,
        ),
      });
    }

    if (this.artist.radioId) {
      this._header.add_button({
        label: _("Radio"),
        icon_name: "sonar-symbolic",
        action_name: "queue.play-playlist",
        action_target: GLib.Variant.new_string(
          `${this.artist.radioId}`,
        ),
      });
    }
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

    this._inner_box.append(carousel);
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
