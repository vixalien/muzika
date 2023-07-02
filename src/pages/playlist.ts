import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

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
import { PlaylistBar } from "src/components/playlist/bar.js";
import { list_model_to_array } from "src/util/list.js";
import {
  EditedValues,
  EditPlaylistDialog,
} from "src/components/playlist/edit.js";

interface PlaylistState {
  playlist: Playlist;
}

Paginator;
PlaylistHeader;
PlaylistItemView;
PlaylistBar;

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
        "select",
        "bar",
        "edit",
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
  private _select!: Gtk.ToggleButton;
  private _bar!: PlaylistBar;
  private _edit!: Gtk.Button;

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
    this._bar.model = this._playlist_item_view.multi_selection_model!;

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

    this._select.connect("toggled", () => {
      this._playlist_item_view.selection_mode = this._select.active;
      this._bar.selection_mode = this._select.active;
      this._bar.update_selection();
      this._playlist_item_view.update();
    });
  }

  private edit_cb() {
    if (!this.playlist?.editable) return;

    const edit_dialog = new EditPlaylistDialog(this.playlist);

    edit_dialog.set_transient_for(this.get_root() as Gtk.Window);

    edit_dialog.connect("saved", (_, values: ObjectContainer<EditedValues>) => {
      this.update_values(values.object);
    });

    edit_dialog.present();
  }

  update_values(values: EditedValues) {
    if (!this.playlist) return;

    this.playlist.title = values.title;
    this.playlist.description = values.description;
    this.playlist.privacy = values.privacy.id as any;

    this._header.set_title(values.title);
    this._header.set_description(values.description);
    this._header.set_genre(values.privacy.name);
  }

  append_tracks(tracks: PlaylistItem[]) {
    const n = this.model.get_n_items();

    this.model.splice(
      n > 0 ? n - 1 : 0,
      0,
      tracks.map((track) => new ObjectContainer(track)),
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
    this._playlist_item_view.editable = this._bar.editable = playlist.editable;
    this._playlist_item_view.show_rank = playlist.tracks[0].rank != null;

    this._bar.playlistId = this.playlist.id;
    this._edit.visible = this.playlist.editable;

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

    this.update_header_buttons();

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

  update_header_buttons() {
    if (!this.playlist) return;

    this._header.clear_buttons();

    this._header.add_button({
      label: _("Shuffle"),
      icon_name: "media-playlist-shuffle-symbolic",
      action_name: "queue.play-playlist",
      action_target: GLib.Variant.new_string(
        `${this.playlist.id}?shuffle=true`,
      ),
    });

    if (this.playlist.editable) {
      this._header.add_button({
        label: _("Edit Playlist"),
        icon_name: "document-edit-symbolic",
        on_clicked: () => {
          this.edit_cb();
        },
      });
    } else {
      this._header.add_button({
        label: _("Add to Library"),
        icon_name: "list-add-symbolic",
      });
    }

    const menu = Gio.Menu.new();

    menu.append(
      _("Start Radio"),
      `queue.play-playlist("${this.playlist.id}?radio=true")`,
    );
    menu.append(
      _("Play Next"),
      `queue.add-playlist("${this.playlist.id}?next=true")`,
    );
    menu.append(
      _("Add to queue"),
      `queue.add-playlist("${this.playlist.id}")`,
    );

    this._header.add_menu_button({
      menu_model: menu,
    });
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

  static async load(context: EndpointContext) {
    const data = await get_playlist(context.match.params.playlistId, {
      related: true,
      signal: context.signal,
    });

    context.set_title(data.title);

    return data;
  }

  get_state(): PlaylistState {
    return {
      playlist: {
        ...this.playlist!,
        tracks: list_model_to_array(this.model)
          .map((container) => container.object)
          .filter((item) => item != null) as PlaylistItem[],
      },
    };
  }

  restore_state(state: PlaylistState) {
    this.present(state.playlist);
  }
}
