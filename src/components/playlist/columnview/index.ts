import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import type { PlaylistItem } from "libmuse";

import { ObjectContainer } from "src/util/objectcontainer";

import { MenuColumn } from "./columns/menu";
import { AddColumn } from "./columns/add";
import { DurationColumn } from "./columns/duration";
import { AlbumColumn } from "./columns/album";
import { ArtistColumn } from "./columns/artist";
import { TitleColumn } from "./columns/title";
import { ChartRankColumn } from "./columns/chart-rank";
import { CoverArtColumn } from "./columns/cover-art";

export class PlaylistColumnView extends Gtk.ColumnView {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistColumnView",
      Properties: {
        "show-rank": GObject.param_spec_boolean(
          "show-rank",
          "Show Rank",
          "Whether to show chart rank and trend change",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        "show-artists": GObject.ParamSpec.boolean(
          "show-artists",
          "Show Artists",
          "Whether to show the artists of each track",
          GObject.ParamFlags.READWRITE,
          true,
        ),
        "show-time": GObject.ParamSpec.boolean(
          "show-time",
          "Show Time",
          "Whether to show the duration of each track",
          GObject.ParamFlags.READWRITE,
          true,
        ),
        playlistId: GObject.param_spec_string(
          "playlist-id",
          "Playlist ID",
          "The playlist ID",
          null as any,
          GObject.ParamFlags.READWRITE,
        ),
        album: GObject.param_spec_boolean(
          "album",
          "Album",
          "Whether this is currently displaying an album",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        show_add: GObject.param_spec_boolean(
          "show-add",
          "Show Add",
          "Show the Save to playlist button",
          false,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT |
            GObject.ParamFlags.CONSTRUCT_ONLY,
        ),
        selection_mode: GObject.param_spec_boolean(
          "selection-mode",
          "Selection Mode",
          "Whether the selection mode is toggled on",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        editable: GObject.param_spec_boolean(
          "editable",
          "Editable",
          "Whether the playlist items can be edited",
          false,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "add": {
          param_types: [GObject.TYPE_INT],
        },
      },
    }, this);
  }

  private _cover_column = new CoverArtColumn();
  private _rank_column = new ChartRankColumn();
  private _title_column = new TitleColumn();
  private _artist_column = new ArtistColumn();
  private _album_column = new AlbumColumn();
  private _duration_column = new DurationColumn();
  private _add_column = new AddColumn();
  private _menu_column = new MenuColumn();

  // property: show-add

  get show_add() {
    return this._add_column.visible;
  }

  set show_add(value: boolean) {
    this._add_column.visible = value;
  }

  // property: selection-mode

  get selection_mode() {
    return this._cover_column.selection_mode;
  }

  set selection_mode(value: boolean) {
    this._cover_column.selection_mode = value;
  }

  // property: show-rank

  get show_rank() {
    return this._rank_column.visible;
  }

  set show_rank(value: boolean) {
    this._rank_column.visible = value;
  }

  // property: show-artists

  get show_artists() {
    return this._artist_column.visible;
  }

  set show_artists(value: boolean) {
    this._artist_column.visible = value;
  }

  // property: show-times

  get show_time() {
    return this._duration_column.visible;
  }

  set show_time(value: boolean) {
    this._duration_column.visible = value;
  }

  // property: playlistId

  private _playlistId?: string;

  get playlistId() {
    return this._playlistId;
  }

  set playlistId(value: string | undefined) {
    this._playlistId = value;
    this._cover_column.playlistId = value;
  }

  // property: album

  private _album = false;

  get album() {
    return this._album;
  }

  set album(value: boolean) {
    this._album = value;
    this._album_column.visible = !value;
    this._cover_column.album = value;
  }

  // property: editable

  private _editable = false;

  get editable() {
    return this._editable;
  }

  set editable(value: boolean) {
    this._menu_column.editable = value;
  }

  constructor(
    {
      show_rank,
      show_artists,
      album,
      playlistId,
      show_time,
      editable,
      ...options
    }: Partial<
      PlaylistColumnViewOptions
    > = {},
  ) {
    super(options);

    if (playlistId != null) {
      this.playlistId = playlistId;
    }

    if (show_rank != null) {
      this.show_rank = show_rank;
    }

    if (show_artists != null) {
      this.show_artists = show_artists;
    }

    if (album != null) {
      this.album = album;
    }

    if (show_time != null) {
      this.show_time = show_time;
    }

    if (editable != null) {
      this.editable = editable;
    }

    this.add_css_class("playlist-column-view");

    this.append_column(this._cover_column);
    this.append_column(this._rank_column);
    this.append_column(this._title_column);
    this.append_column(this._artist_column);
    this.append_column(this._album_column);
    this.append_column(this._duration_column);
    this.append_column(this._add_column);
    this.append_column(this._menu_column);

    this._add_column.connect("add", (_, position: number) => {
      this.emit("add", position);
    });

    this.connect("activate", (_, position) => {
      const container = this.model.get_item(position) as ObjectContainer<
        PlaylistItem
      >;

      if (this.playlistId) {
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${this.playlistId}?video=${container.object.videoId}`,
          ),
        );
      } else {
        this.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(container.object.videoId),
        );
      }
    });
  }

  update() {
    this.sorter.changed(Gtk.SorterChange.DIFFERENT);
  }
}

export interface PlaylistColumnViewOptions
  extends Gtk.ColumnView.ConstructorProperties {
  playlistId: string;
  show_rank: boolean;
  album: boolean;
  show_add: boolean;
  show_time: boolean;
}
