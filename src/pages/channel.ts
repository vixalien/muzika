import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import {
  Category,
  Channel,
  get_channel,
  MixedItem,
  PlaylistItem,
} from "src/muse.js";

import { ArtistHeader } from "../components/artistheader.js";
import { Carousel } from "../components/carousel/index.js";
import { EndpointContext, MuzikaComponent } from "src/navigation.js";
import { PlaylistListView } from "src/components/playlist/listview.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";

interface ChannelState {
  channel: Channel;
}

ArtistHeader;
PlaylistListView;

export class ChannelPage extends Adw.Bin
  implements MuzikaComponent<Channel, ChannelState> {
  static {
    GObject.registerClass({
      GTypeName: "ChannelPage",
      Template: "resource:///com/vixalien/muzika/ui/pages/channel.ui",
      InternalChildren: [
        "breakpoint",
        "inner_box",
        "songs_on_repeat",
        "playlist_item_view",
        "header",
      ],
    }, this);
  }

  channel?: Channel;

  private _breakpoint!: Adw.Breakpoint;
  private _inner_box!: Gtk.Box;
  private _songs_on_repeat!: Gtk.Box;
  private _playlist_item_view!: PlaylistItemView;
  private _header!: ArtistHeader;

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

    this._header.set_description(null);
  }

  show_songs_on_repeat(songs: PlaylistItem[] | null) {
    if (!songs) {
      this._songs_on_repeat.visible = false;
      return;
    }

    this._songs_on_repeat.visible = true;

    if (songs && songs.length > 0) {
      this._songs_on_repeat.visible = true;
      const n = this.model.get_n_items();

      this.model.splice(
        n > 0 ? n - 1 : 0,
        0,
        songs.map((track) => PlayableContainer.new_from_playlist_item(track)),
      );
    } else {
      this._songs_on_repeat.visible = false;
    }
  }

  present(channel: Channel) {
    this.model.remove_all();

    this.channel = channel;

    if (channel.thumbnails) this._header.load_thumbnails(channel.thumbnails);

    this._header.set_title(channel.name);

    this.show_songs_on_repeat(channel.songs_on_repeat?.results ?? null);

    this.add_carousel(_("Videos"), null, channel.videos);
    this.add_carousel(
      _("Artists on repeat"),
      _("Last 7 days"),
      channel.artists_on_repeat,
    );
    this.add_carousel(
      _("Playlists on repeat"),
      _("Last 7 days"),
      channel.playlists_on_repeat,
    );
    this.add_carousel(_("Playlists"), null, channel.playlists, true);
  }

  add_carousel(
    title: string,
    subtitle: string | null,
    data: Category<MixedItem> | null,
    show_more_button = false,
  ) {
    if (!data || data.results.length === 0) return;

    const carousel = new Carousel();

    carousel.setup_more_button(
      (show_more_button && data.browseId != null && data.params != null)
        ? `navigator.visit("muzika:channel-playlists:${data.browseId}:${data.params}")`
        : null,
    );

    carousel.show_content({
      title,
      subtitle,
      contents: data.results,
    });

    this._inner_box.append(carousel);
  }

  static async load(context: EndpointContext) {
    const artist = await get_channel(context.match.params.channelId, {
      signal: context.signal,
    });

    context.set_title(artist.name);

    return artist;
  }

  get_state(): ChannelState {
    return {
      channel: this.channel!,
    };
  }

  restore_state(state: ChannelState) {
    this.present(state.channel);
  }
}
