import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Pango from "gi://Pango";
import GLib from "gi://GLib";

import { ObjectContainer } from "src/util/objectcontainer";
import { PlaylistItem } from "src/muse";
import { DynamicImage, DynamicImageVisibleChild } from "../dynamic-image";
import { escape_label, pretty_subtitles } from "src/util/text";

class ImageColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "ImageColumn" }, this);
  }

  album = false;

  constructor(public playlistId?: string) {
    super();

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = new DynamicImage({
      image_size: 36,
      icon_size: 16,
      persistent_play_button: false,
    });

    if (this.album) {
      dynamic_image.visible_child = DynamicImageVisibleChild.NUMBER;
    }

    list_item.set_child(dynamic_image);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const dynamic_image = list_item.child as DynamicImage;
    const container = list_item.item as ObjectContainer<PlaylistItem>;

    const playlist_item = container.item!;

    if (this.album) {
      dynamic_image.track_number = (list_item.position + 1).toString();
    } else {
      dynamic_image.load_thumbnails(playlist_item.thumbnails);
    }

    dynamic_image.setup_video(playlist_item.videoId, this.playlistId);
  }
}

class ChartRankBox extends Gtk.Box {
  static {
    GObject.registerClass({ GTypeName: "ChartRankBox" }, this);
  }

  private _rank = new Gtk.Label();
  private _change = new Gtk.Image();
  private _container = new Gtk.Box({
    valign: Gtk.Align.CENTER,
    hexpand: true,
    halign: Gtk.Align.CENTER,
    spacing: 6,
  });

  get rank() {
    return this._rank.label;
  }

  set rank(value: string) {
    this._rank.label = value;
  }

  get icon_name() {
    return this._change.icon_name;
  }

  set icon_name(value: string) {
    this._change.icon_name = value;
  }

  constructor() {
    super({
      width_request: 36,
    });

    this._rank.add_css_class("dim-label");

    this._container.append(this._rank);
    this._container.append(this._change);

    this.append(this._container);
  }
}

class ChartRankColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "ChartRankColumn" }, this);
  }

  constructor() {
    super({
      visible: false,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("teardown", this.teardown_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const box = new ChartRankBox();

    list_item.set_child(box);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const box = list_item.child as ChartRankBox;
    const container = list_item.item as ObjectContainer<PlaylistItem>;

    const playlist_item = container.item!;

    if (playlist_item.rank) {
      box.rank = playlist_item.rank;

      switch (playlist_item.change) {
        case "DOWN":
          box.icon_name = "trend-down-symbolic";
          break;
        case "UP":
          box.icon_name = "trend-up-symbolic";
          break;
        default:
          box.icon_name = "trend-neutral-symbolic";
          break;
      }
    }
  }

  teardown_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    list_item.set_child(null);
  }
}

class TitleColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "TitleColumn" }, this);
  }

  constructor() {
    super({
      title: _("Song"),
      expand: true,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = new Gtk.Label({
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
      lines: 2,
      xalign: 0,
    });

    list_item.set_child(label);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = list_item.child as Gtk.Label;
    const container = list_item.item as ObjectContainer<PlaylistItem>;

    const playlist_item = container.item!;

    label.label = playlist_item.title;
  }
}

class ArtistColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "ArtistColumn" }, this);
  }

  constructor() {
    super({
      title: _("Artist"),
      expand: true,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = new Gtk.Label({
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
      lines: 2,
      xalign: 0,
    });

    label.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        label.activate_action("navigator.visit", GLib.Variant.new_string(uri));

        return true;
      }
    });

    label.add_css_class("flat-links");
    label.add_css_class("dim-label");

    list_item.set_child(label);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = list_item.child as Gtk.Label;
    const container = list_item.item as ObjectContainer<PlaylistItem>;

    const playlist_item = container.item!;

    const subtitle = pretty_subtitles(playlist_item.artists);

    label.set_markup(subtitle.markup);
    label.tooltip_text = subtitle.plain;
  }
}

class AlbumColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "AlbumColumn" }, this);
  }

  constructor() {
    super({
      title: _("Album"),
      expand: true,
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = new Gtk.Label({
      hexpand: true,
      ellipsize: Pango.EllipsizeMode.END,
      lines: 2,
      xalign: 0,
    });

    label.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        label.activate_action("navigator.visit", GLib.Variant.new_string(uri));

        return true;
      }
    });

    label.add_css_class("flat-links");
    label.add_css_class("dim-label");

    list_item.set_child(label);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = list_item.child as Gtk.Label;
    const container = list_item.item as ObjectContainer<PlaylistItem>;

    const playlist_item = container.item!;

    if (playlist_item.album) {
      if (playlist_item.album.id) {
        label.set_markup(
          `<a href="muzika:album:${playlist_item.album.id}">${
            escape_label(playlist_item.album.name)
          }</a>`,
        );
      } else {
        label.use_markup = false;
        label.label = playlist_item.album.name;
      }

      label.tooltip_text = playlist_item.album.name;
    } else {
      label.label = "";
    }
  }
}

class DurationColumn extends Gtk.ColumnViewColumn {
  static {
    GObject.registerClass({ GTypeName: "DurationColumn" }, this);
  }

  constructor() {
    super({
      title: _("Time"),
    });

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));

    this.factory = factory;
  }

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = new Gtk.Label({
      xalign: 0,
    });

    label.add_css_class("dim-label");

    list_item.set_child(label);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const label = list_item.child as Gtk.Label;
    const container = list_item.item as ObjectContainer<PlaylistItem>;

    const playlist_item = container.item!;

    label.label = playlist_item.duration ?? "";
  }
}

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
      },
    }, this);
  }

  private _image_column = new ImageColumn();
  private _rank_column = new ChartRankColumn();
  private _title_column = new TitleColumn();
  private _artist_column = new ArtistColumn();
  private _album_column = new AlbumColumn();
  private _duration_column = new DurationColumn();

  get show_rank() {
    return this._rank_column.visible;
  }

  set show_rank(value: boolean) {
    this._rank_column.visible = value;
  }

  private _playlistId?: string;

  get playlistId() {
    return this._playlistId;
  }

  set playlistId(value: string | undefined) {
    this._playlistId = value;
    this.regenerate_image_column();
  }

  private _album = false;

  get album() {
    return this._album;
  }

  set album(value: boolean) {
    this._album = value;
    this._album_column.visible = !value;
    this.regenerate_image_column();
  }

  constructor(options: PlaylistColumnViewOptions = {}) {
    super({
      margin_start: 12,
      margin_end: 12,
      single_click_activate: true,
    });

    if (options.album != null) {
      this.album = options.album;
    }

    if (options.show_rank != null) {
      this.show_rank = true;
    }

    if (options.playlistId != null) {
      this.playlistId = options.playlistId;
    }

    this.add_css_class("playlist-column-view");

    this.append_column(this._image_column);
    this.append_column(this._rank_column);
    this.append_column(this._title_column);
    this.append_column(this._artist_column);
    this.append_column(this._album_column);
    this.append_column(this._duration_column);

    this.connect("activate", (_, position) => {
      const item = this.model.get_item(position) as ObjectContainer<
        PlaylistItem
      >;

      if (!item?.item) return null;

      if (this.playlistId) {
        this.activate_action(
          "queue.play-playlist",
          GLib.Variant.new_string(
            `${this.playlistId}?video=${item.item.videoId}`,
          ),
        );
      } else {
        this.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(item.item.videoId),
        );
      }
    });
  }

  private regenerate_image_column() {
    this.remove_column(this._image_column);
    this._image_column = new ImageColumn();
    this._image_column.playlistId = this._playlistId;
    this._image_column.album = this._album;
    this.insert_column(0, this._image_column);
  }
}

export interface PlaylistColumnViewOptions {
  playlistId?: string;
  show_rank?: boolean;
  album?: null;
}
