import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { get_channel_playlists } from "libmuse";
import type { ChannelPlaylists } from "libmuse";

import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import { CarouselGridView } from "src/components/carousel/view/grid";
import { PlayableContainer } from "src/util/playablelist";
import { MixedCardItem } from "src/components/library/mixedcard";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled";

interface ChannelPlaylistsState extends VScrollState {
  contents: ChannelPlaylists;
}

GObject.type_ensure(CarouselGridView.$gtype);

export class ChannelPlaylistsPage
  extends Adw.Bin
  implements MuzikaPageWidget<ChannelPlaylists, ChannelPlaylistsState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "ChannelPlaylistsPage",
        Template:
          "resource:///com/vixalien/muzika/ui/pages/channel-playlists.ui",
        InternalChildren: ["view", "scrolled"],
      },
      this,
    );
  }

  private _view!: CarouselGridView;
  private _scrolled!: Gtk.ScrolledWindow;

  constructor() {
    super();

    this._view.connect("activate", (_, position) => {
      const container = this._view.items.get_item(position);

      this.activate_cb(container?.object ?? null);
    });
  }

  // you never know if it's only an Album or any other MixedCardItem
  activate_cb(item: MixedCardItem | null) {
    if (!item) return;

    let uri: string | null = null;

    switch (item.type) {
      case "playlist":
      case "watch-playlist":
        uri = `playlist:${item.playlistId}`;
        break;
      case "artist":
        uri = `artist:${item.browseId}`;
        break;
      case "album":
        uri = `album:${item.browseId}`;
        break;
      case "inline-video":
      case "song":
      case "video":
      case "flat-song":
        if (item.videoId) {
          this.activate_action(
            "queue.play-song",
            GLib.Variant.new_string(item.videoId),
          );
        }
        break;
    }

    if (uri) {
      this.activate_action(
        "navigator.visit",
        GLib.Variant.new_string("muzika:" + uri),
      );
    }
  }

  results?: ChannelPlaylists;

  present(results: ChannelPlaylists) {
    this.results = results;

    this.show_channel_playlists(results);
  }

  get_state() {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      contents: this.results!,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: ChannelPlaylistsState): void {
    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
    this.show_channel_playlists(state.contents);
  }

  private show_channel_playlists(content: ChannelPlaylists) {
    this._view.items.splice(
      0,
      0,
      content.results
        .filter((item) => item != null)
        .map(PlayableContainer.new_from_mixed_card_item),
    );
  }

  static async load(context: PageLoadContext) {
    const results = await get_channel_playlists(
      context.match.params.channelId,
      context.match.params.params,
      {
        signal: context.signal,
      },
    );

    context.set_title(`${results.artist} - ${results.title}`);

    return results;
  }
}
