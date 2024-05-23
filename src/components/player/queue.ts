import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import type { QueueTrack } from "libmuse";

import { ObjectContainer } from "src/util/objectcontainer";
import { QueueItem } from "./queueitem";
import { MuzikaPlayer } from "src/player";
import { escape_label } from "src/util/text";
import { get_player } from "src/application";
import { setup_link_label } from "src/util/label";
import { list_model_to_array } from "src/util/list";

export class QueueView extends Gtk.Stack {
  static {
    GObject.registerClass({
      GTypeName: "QueueView",
      Template: "resource:///com/vixalien/muzika/ui/components/player/queue.ui",
      InternalChildren: [
        "no_queue",
        "list_view",
        "queue_box",
        "playlist_label",
        "params",
        "params_box",
      ],
    }, this);
  }

  private _list_view!: Gtk.ListView;
  private _queue_box!: Gtk.Box;
  private _no_queue!: Adw.StatusPage;
  private _playlist_label!: Gtk.Label;
  private _params!: Gtk.Box;
  private _params_box!: Gtk.Box;

  player: MuzikaPlayer;

  params_map = new Map<string, Gtk.Widget>();

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

    this.player.queue.connect("notify::position", () => {
      if (this.player.queue.position < 0) {
        this._list_view.model.unselect_all();
      } else {
        this._list_view.model.select_item(this.player.queue.position, true);
      }
    });

    this.player.queue.chips.connect(
      "items-changed",
      this.update_chips.bind(this),
    );

    // set up the list view

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    this._list_view.connect("activate", this.activate_cb.bind(this));

    this._list_view.model = Gtk.SingleSelection.new(this.player.queue.list);
    this._list_view.factory = factory;

    this._list_view.remove_css_class("view");
    this._list_view.remove_css_class("background");

    setup_link_label(this._playlist_label);
  }

  update_chips() {
    this.params_map.clear();

    let first_param: Gtk.Widget | null = null;

    while (first_param = this._params_box.get_first_child()) {
      this._params_box.remove(first_param);
    }

    const chips = list_model_to_array(this.player.queue.chips);

    if (chips.length > 0) {
      this._params.show();

      chips.forEach((chip) => {
        const button = new Gtk.ToggleButton({
          label: chip.title,
          action_target: GLib.Variant.new_string(chip.playlist_id),
          action_name: `queue.active-chip`,
        });

        this._params_box.append(button);
      });
    } else {
      this._params.hide();
    }
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const container = list_item.get_item() as ObjectContainer<QueueTrack>;
    const track = container.object;

    const card = new QueueItem();
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
}
