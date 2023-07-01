import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import {
  Artist,
  Category,
  get_artist,
  MixedItem,
  PlaylistItem,
} from "../muse.js";

import { ArtistHeader } from "../components/artistheader.js";
import { Carousel } from "../components/carousel/index.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { PlaylistListView } from "src/components/playlist/listview.js";
import { ObjectContainer } from "src/util/objectcontainer.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";

interface ArtistState {
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

  show_top_songs(songs: Artist["songs"]) {
    this._playlist_item_view.playlistId = songs.browseId ?? undefined;

    if (songs.results && songs.results.length > 0) {
      this._top_songs.visible = true;
      const n = this.model.get_n_items();

      this.model.splice(
        n > 0 ? n - 1 : 0,
        0,
        songs.results.map((track) => ObjectContainer.new(track)),
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

    this.show_top_songs(artist.songs);

    this.add_carousel(_("Albums"), artist.albums);
    this.add_carousel(_("Singles"), artist.singles);
    this.add_carousel(_("Videos"), artist.videos);
    this.add_carousel(_("From your library"), artist.library);
    this.add_carousel(_("Featured on"), artist.featured);
    this.add_carousel(_("Playlists"), artist.playlists);
    this.add_carousel(_("Fans might also like"), artist.related);
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
    };
  }

  restore_state(state: ArtistState) {
    this.present(state.artist);
  }
}
