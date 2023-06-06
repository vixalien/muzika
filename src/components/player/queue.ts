import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";
import GLib from "gi://GLib";

import { ObjectContainer } from "src/util/objectcontainer";
import type { QueueTrack } from "libmuse/types/parsers/queue";
import { QueueItem } from "./queueitem";
import { Player } from "src/player";

export class QueueView extends Gtk.Stack {
  static {
    GObject.registerClass({
      GTypeName: "QueueView",
      Template: "resource:///com/vixalien/muzika/components/player/queue.ui",
      InternalChildren: [
        "no_queue",
        "list_view",
        "queue_window",
        "playlist_stack",
        "playlist_name",
        "playlist_button",
        "playlist_button_name",
        "params",
        "params_box",
      ],
    }, this);
  }

  _list_view!: Gtk.ListView;
  _queue_window!: Gtk.ScrolledWindow;
  _no_queue!: Adw.StatusPage;
  _playlist_stack!: Gtk.Stack;
  _playlist_name!: Gtk.Label;
  _playlist_button!: Gtk.Button;
  _playlist_button_name!: Gtk.Label;
  _params!: Gtk.Box;
  _params_box!: Gtk.Box;

  player: Player;

  params_map = new Map<string, Gtk.Widget>();

  constructor({ player }: QueueViewOptions) {
    super();

    // set up the queue

    this.player = player;

    this.player.queue.connect("notify::settings", () => {
      this.update_settings();
    });

    this.player.queue.list.connect("notify::n-items", () => {
      this.update_visible_child();
    });

    this.player.queue.connect("notify::position", () => {
      if (this.player.queue.position < 0) {
        this._list_view.model.unselect_all();
      } else {
        this._list_view.model.select_item(this.player.queue.position, true);
      }
    });

    // set up the list view

    const factory = Gtk.SignalListItemFactory.new();
    factory.connect("bind", this.bind_cb.bind(this));
    this._list_view.connect("activate", this.activate_cb.bind(this));

    this._list_view.model = Gtk.SingleSelection.new(player.queue.list);
    this._list_view.factory = factory;

    this._list_view.remove_css_class("view");

    this.update_visible_child();
    this.update_settings();
  }

  update_visible_child() {
    this.visible_child = this.player.queue.list.n_items > 0
      ? this._queue_window
      : this._no_queue;
  }

  update_settings() {
    const settings = this.player.queue.settings;

    if (settings?.playlistId) {
      this._playlist_stack.set_visible_child(this._playlist_button);

      this._playlist_button.action_name = "navigator.visit";
      this._playlist_button.action_target = GLib.Variant.new_string(
        `muzika:playlist:${settings.playlistId}`,
      );

      this._playlist_button_name.label = settings?.playlist ?? "Queue";
    } else {
      this._playlist_stack.set_visible_child(this._playlist_name);

      this._playlist_name.label = settings?.playlist ?? "Queue";
    }

    this.params_map.clear();

    let first_param: Gtk.Widget | null = null;

    while (first_param = this._params_box.get_first_child()) {
      this._params_box.remove(first_param);
    }

    if (settings?.chips && settings.chips.length > 0) {
      this._params.show();

      let first_button: Gtk.ToggleButton | null = null;

      settings.chips.forEach((chip) => {
        const button = Gtk.ToggleButton.new_with_label(chip.title);

        if (!first_button) {
          first_button = button;

          if (!this.player.queue.active_chip) {
            button.set_active(true);
          }
        } else {
          button.set_group(first_button);
        }

        button.connect("toggled", (button) => {
          if (button.active) {
            this.player.queue.change_active_chip(chip.playlistId);
          }
        });

        this._params_box.append(button);
      });
    } else {
      this._params.hide();
    }
  }

  bind_cb(_factory: Gtk.ListItemFactory, list_item: Gtk.ListItem) {
    const object = list_item.get_item() as ObjectContainer<QueueTrack>;
    const track = object.item!;

    const card = new QueueItem();
    card.set_track(track);

    list_item.set_child(card);

    const parent = card.get_parent();

    if (parent) {
      parent.add_css_class("hover-parent");
      parent.add_css_class("focus-parent");
      parent.add_css_class("background");
    }
  }

  activate_cb() {}
}

export interface QueueViewOptions {
  player: Player;
}
