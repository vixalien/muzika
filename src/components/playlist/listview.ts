import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import type { PlaylistItem } from "libmuse";

import { PlaylistListItem } from "./listitem";
import { SignalListeners } from "src/util/signal-listener";
import { PlayableContainer } from "src/util/playablelist";
import { DynamicImage } from "../dynamic-image";
import { ObjectContainer } from "src/util/objectcontainer";

interface PlaylistListItemWithSignals extends PlaylistListItem {
  signals: SignalListeners;
}

export class PlaylistListView extends Gtk.ListView {
  static {
    GObject.registerClass({
      GTypeName: "PlaylistListView",
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
        show_add: GObject.param_spec_boolean(
          "show-add",
          "Show Add",
          "Show the Save to playlist button",
          false,
          GObject.ParamFlags.READWRITE,
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

  album = false;
  selection_mode = false;
  playlistId?: string;
  editable = false;

  constructor(
    { model, album, selection_mode, show_add, editable, ...props }: Partial<
      Gtk.ListView.ConstructorProperties
    > = {},
  ) {
    super({ single_click_activate: true, ...props });

    if (album != null) this.album = album;

    if (model !== undefined) this.model = model!;

    if (selection_mode != null) this.selection_mode = selection_mode;

    if (show_add != null) this.show_add = show_add;

    if (editable != null) this.editable = editable;

    this.add_css_class("playlist-list-view");

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("setup", this.setup_cb.bind(this));
    factory.connect("bind", this.bind_cb.bind(this));
    factory.connect("unbind", this.unbind_cb.bind(this));

    this.factory = factory;

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

  setup_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = new PlaylistListItem() as PlaylistListItemWithSignals;

    item.signals = new SignalListeners();

    list_item.set_child(item);
  }

  bind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItemWithSignals;
    const container = list_item.item as PlayableContainer;

    const playlist_item = container.object;

    item.show_add = this.show_add;

    // item.dynamic_image.selection_mode = this.selection_mode;
    // item.dynamic_image.selected = list_item.selected;

    item.set_item(
      list_item.position,
      playlist_item,
      this.playlistId,
      this.editable,
    );

    // if (this.album) {
    //   item.dynamic_image.track_number = list_item.position + 1;
    // }

    // item.signals.connect(
    //   item.dynamic_image,
    //   "notify::selected",
    //   (dynamic_image: DynamicImage) => {
    //     this.selection_mode_toggled(
    //       list_item.position,
    //       dynamic_image.selected,
    //     );
    //   },
    // );

    // item.signals.add(
    //   container,
    //   container.connect("notify::state", () => {
    //     item.dynamic_image.state = container.state;
    //   }),
    // );

    // item.dynamic_image.state = container.state;

    // item.signals.add(
    //   container,
    //   container.connect("notify", () => {
    //     item.dynamic_image.selection_mode = this.selection_mode;
    //     item.show_add = this.show_add;
    //   }),
    // );

    item.signals.add(
      item,
      item.connect("add", (_) => {
        this.emit("add", list_item.position);
      }),
    );
  }

  unbind_cb(_factory: Gtk.SignalListItemFactory, list_item: Gtk.ListItem) {
    const item = list_item.child as PlaylistListItemWithSignals;

    item.signals.clear();
    item.clear();
  }

  private selection_mode_toggled(position: number, value: boolean) {
    if (value) {
      this.model.select_item(position, false);
    } else {
      this.model.unselect_item(position);
    }
  }

  show_add = false;
}
