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
    GObject.registerClass(
      {
        GTypeName: "PlaylistColumnView",
        Properties: {
          is_album: GObject.param_spec_boolean(
            "is-album",
            "Represents an album",
            "Whether this playlist represents an album",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          is_editable: GObject.param_spec_boolean(
            "is-editable",
            "Is editable",
            "Whether the playlist items can be edited (or deleted)",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          playlist_id: GObject.param_spec_string(
            "playlist-id",
            "Playlist ID",
            "The playlist ID",
            null,
            GObject.ParamFlags.READWRITE,
          ),
          selection_mode: GObject.param_spec_boolean(
            "selection-mode",
            "Selection mode",
            "Whether the selection mode is toggled on",
            false,
            GObject.ParamFlags.READWRITE,
          ),
          show_add_column: GObject.param_spec_boolean(
            "show-add-column",
            "Show the add column",
            "Show a button to trigger the 'Save to playlist' action",
            false,
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          ),
          show_artists_column: GObject.ParamSpec.boolean(
            "show-artists-column",
            "Show the artists column",
            "Whether to show the artists of each track",
            GObject.ParamFlags.READWRITE,
            true,
          ),
          show_duration_column: GObject.ParamSpec.boolean(
            "show-duration-column",
            "Show the duration column",
            "Whether to show the duration of each track",
            GObject.ParamFlags.READWRITE,
            true,
          ),
          show_rank_column: GObject.param_spec_boolean(
            "show-rank-column",
            "Show the rank column",
            "Whether to show chart rank and trend change",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
        Signals: {
          add: {
            param_types: [GObject.TYPE_INT],
          },
        },
      },
      this,
    );
  }

  private _add_column = new AddColumn();
  private _album_column = new AlbumColumn();
  private _artist_column = new ArtistColumn();
  private _cover_column = new CoverArtColumn();
  private _duration_column = new DurationColumn();
  private _menu_column = new MenuColumn();
  private _rank_column = new ChartRankColumn();
  private _title_column = new TitleColumn();

  // properties

  is_album!: boolean;
  is_editable?: boolean;
  playlist_id?: string;
  selection_mode!: boolean;
  show_add_column!: boolean;
  show_artists_column!: boolean;
  show_duration_column!: boolean;
  show_rank_column!: boolean;

  constructor(options: Partial<PlaylistColumnViewOptions> = {}) {
    super(options);

    // binding properties

    // is-album

    this.bind_property(
      "is-album",
      this._cover_column,
      "is-album",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this.bind_property(
      "is-album",
      this._album_column,
      "visible",
      GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.INVERT_BOOLEAN,
    );

    // is-editable

    this.bind_property(
      "is-editable",
      this._menu_column,
      "is-editable",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // playlist-id

    // this.bind_property(
    //   "playlist-id",
    //   this._cover_column,
    //   "playlist-id",
    //   GObject.BindingFlags.SYNC_CREATE,
    // );

    // selection-mode

    this.bind_property(
      "selection-mode",
      this._cover_column,
      "selection-mode",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // show-add-column

    this.bind_property(
      "show-add-column",
      this._add_column,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // show-artists-column

    this.bind_property(
      "show-artists-column",
      this._artist_column,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // show-duration-column

    this.bind_property(
      "show-duration-column",
      this._duration_column,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // show-rank-column

    this.bind_property(
      "show-rank-column",
      this._rank_column,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
    );

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
      const container = this.model.get_item(
        position,
      ) as ObjectContainer<PlaylistItem>;

      if (this.playlist_id) {
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${this.playlist_id}?video=${container.object.videoId}`,
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
  is_album: boolean;
  show_add: boolean;
  show_rank: boolean;
  show_artists: boolean;
  show_time: boolean;
}
