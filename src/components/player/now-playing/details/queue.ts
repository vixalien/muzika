import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import type { QueueTrack } from "libmuse";

import { ObjectContainer } from "src/util/objectcontainer";
import { MuzikaNPQueueItem } from "./queueitem";
import { MuzikaPlayer } from "src/player";
import { escape_label } from "src/util/text";
import { get_player } from "src/application";
import { setup_link_label } from "src/util/label";
import { QueueChip } from "src/player/queue";
import { list_model_to_array } from "src/util/list";

export class MuzikaNPQueue extends Gtk.Stack {
  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaNPQueue",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/details/queue.ui",
        InternalChildren: [
          "no_queue",
          "list_view",
          "queue_box",
          "playlist_label",
          "params_window",
          "param_toggles",
        ],
      },
      this,
    );
  }

  private _list_view!: Gtk.ListView;
  private _queue_box!: Gtk.Box;
  private _no_queue!: Adw.StatusPage;
  private _playlist_label!: Gtk.Label;
  private _params_window!: Gtk.Box;
  /// @ts-expect-error outdated types
  private _param_toggles!: Adw.ToggleGroup;

  private player: MuzikaPlayer;

  constructor() {
    super();

    // set up the queue

    this.player = get_player();

    // @ts-expect-error incorrect types
    this.player.queue.list.bind_property_full(
      "n-items",
      this,
      "visible-child",
      GObject.BindingFlags.SYNC_CREATE,
      (_, count) => {
        return [true, count > 0 ? this._queue_box : this._no_queue];
      },
      null,
    );

    this.player.queue.bind_property(
      "playlist-name",
      this._playlist_label,
      "tooltip-text",
      GObject.BindingFlags.SYNC_CREATE,
    );

    // @ts-expect-error incorrect types
    this.player.queue.bind_property_full(
      "playlist-name",
      this._playlist_label,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      (__, from) => {
        const playlist_id = this.player.queue.playlist_id;
        const playlist_name = escape_label(from ?? _("Queue"));

        if (playlist_id && !playlist_id.startsWith("RDA")) {
          return [
            true,
            `<a href="muzika:playlist:${playlist_id}">${playlist_name}</a>`,
          ];
        } else {
          return [true, playlist_name];
        }
      },
      null,
    );

    /// @ts-expect-error incorrect types here
    this.player.queue.chips.bind_property_full(
      "n-items",
      this._params_window,
      "visible",
      GObject.BindingFlags.SYNC_CREATE,
      (_, n_items) => {
        return [true, n_items > 0];
      },
      null,
    );

    this.player.queue.bind_property(
      "active-chip",
      this._param_toggles,
      "active-name",
      GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL,
    );

    this.player.queue.chips.connect(
      "items-changed",
      this.update_chips.bind(this),
    );

    // set up the list view

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    this._list_view.connect("activate", this.activate_cb.bind(this));

    this._list_view.model = this.player.queue.selection_list;
    this._list_view.factory = factory;

    this._list_view.remove_css_class("view");
    this._list_view.remove_css_class("background");

    setup_link_label(this._playlist_label);
  }

  update_chips(
    model: Gio.ListModel,
    position: number,
    removed: number,
    added: number,
  ) {
    // remove removed items
    for (let i = 0; i < removed; i++) {
      this._param_toggles.remove(this._param_toggles.get_toggle(position));
    }

    // add added items
    for (let i = 0; i < added; i++) {
      const chip = model.get_item(position + i) as QueueChip;

      /// @ts-expect-error outdated types
      const toggle = new Adw.Toggle({
        name: chip.playlist_id,
        label: chip.title,
      });

      this._param_toggles.add(toggle);
    }
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const container = list_item.get_item() as ObjectContainer<QueueTrack>;
    const track = container.object;

    const card = new MuzikaNPQueueItem();
    card.set_track(track);

    list_item.set_child(card);

    const parent = card.get_parent();

    if (parent) {
      parent.add_css_class("hover-parent");
      parent.add_css_class("focus-parent");
    }
  }

  activate_cb(_: Gtk.ListView, position: number) {
    this.player.queue.change_position(position);
    this.player.queue.emit("play");
  }

  vfunc_map(): void {
    this._list_view.scroll_to(
      this.player.queue.position,
      Gtk.ListScrollFlags.NONE,
      null,
    );
    super.vfunc_map();
  }

  private on_queue_saved_cb() {
    const tracks = list_model_to_array(this.player.queue.list);
    const ids = tracks.map((track) => track.object.videoId).join(",");

    this.activate_action("win.add-to-playlist", GLib.Variant.new_string(ids));
  }
}
