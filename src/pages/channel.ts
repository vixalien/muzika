import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gio from "gi://Gio";

import { get_channel } from "libmuse";
import type { Category, Channel, MixedItem, PlaylistItem } from "libmuse";

import { Carousel } from "../components/carousel/index.js";
import { MuzikaPageWidget, PageLoadContext } from "src/navigation.js";
import { PlaylistListView } from "src/components/playlist/listview.js";
import { PlaylistItemView } from "src/components/playlist/itemview.js";
import { PlayableContainer, PlayableList } from "src/util/playablelist.js";
import {
  set_scrolled_window_initial_vscroll,
  VScrollState,
} from "src/util/scrolled.js";
import { PlaylistHeader } from "src/components/playlist/header.js";

interface ChannelState extends VScrollState {
  channel: Channel;
}

GObject.type_ensure(PlaylistHeader.$gtype);
GObject.type_ensure(PlaylistListView.$gtype);

export class ChannelPage
  extends Adw.Bin
  implements MuzikaPageWidget<Channel, ChannelState>
{
  static {
    GObject.registerClass(
      {
        GTypeName: "ChannelPage",
        Template: "resource:///com/vixalien/muzika/ui/pages/channel.ui",
        InternalChildren: [
          "songs_on_repeat",
          "playlist_item_view",
          "header",
          "carousels",
          "menu",
          "scrolled",
        ],
      },
      this,
    );
  }

  channel?: Channel;

  private _songs_on_repeat!: Gtk.Box;
  private _playlist_item_view!: PlaylistItemView;
  private _header!: PlaylistHeader;
  private _carousels!: Gtk.Box;
  private _menu!: Gtk.MenuButton;
  private _scrolled!: Gtk.ScrolledWindow;

  model = new PlayableList();

  constructor() {
    super();

    this._playlist_item_view.model = Gtk.MultiSelection.new(this.model);

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

    this.setup_menu();
  }

  private setup_menu() {
    if (!this.channel) return;

    const menu = Gio.Menu.new();

    const share_section = Gio.Menu.new();

    share_section.append(
      _("Copy Link"),
      `win.copy-url("https://music.youtube.com/channel/${this.channel.channelId}")`,
    );

    menu.append_section(null, share_section);

    this._menu.menu_model = menu;
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
      show_more_button && data.browseId != null && data.params != null
        ? `navigator.visit("muzika:channel-playlists:${data.browseId}:${data.params}")`
        : null,
    );

    carousel.show_content({
      title,
      subtitle,
      contents: data.results,
    });

    this._carousels.append(carousel);
  }

  static async load(context: PageLoadContext) {
    const artist = await get_channel(context.match.params.channelId, {
      signal: context.signal,
    });

    context.set_title(artist.name);

    return artist;
  }

  get_state(): ChannelState {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      channel: this.channel!,
      vscroll: this._scrolled.get_vadjustment().get_value(),
    };
  }

  restore_state(state: ChannelState) {
    set_scrolled_window_initial_vscroll(this._scrolled, state.vscroll);
    this.present(state.channel);
  }
}
