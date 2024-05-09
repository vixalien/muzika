import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { QueueItem } from "./queueitem";
import { MuzikaPlayer } from "src/player";
import { escape_label } from "src/util/text";
import { get_player } from "src/application";
import { setup_link_label } from "src/util/label";
import { ObjectContainer } from "src/util/objectcontainer";
import { QueueTrack } from "libmuse";

export class QueueView extends Gtk.Stack {
  static {
    GObject.registerClass(
      {
        GTypeName: "QueueView",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/queue.ui",
        InternalChildren: [
          "no_queue",
          "list_view",
          "queue_box",
          "playlist_label",
          "params",
          "params_box",
        ],
      },
      this,
    );
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

    this._list_view.model = Gtk.SingleSelection.new(this.player.queue.list);
    this._list_view.factory = factory;

    this._list_view.remove_css_class("view");
    this._list_view.remove_css_class("background");

    this._list_view.connect("activate", (_, position) => {
      this.player.queue.change_position(position);
      this.player.queue.emit("play");
    });

    this.update_visible_child();
    this.update_settings();

    setup_link_label(this._playlist_label);
  }

  update_visible_child() {
    this.visible_child =
      this.player.queue.list.n_items > 0 ? this._queue_box : this._no_queue;
  }

  update_settings() {
    const settings = this.player.queue.settings.object;
    const playlist_name = escape_label(settings?.playlist ?? _("Queue"));

    // radio playlists can't be visited
    if (settings?.playlistId && !settings.playlistId.startsWith("RDA")) {
      this._playlist_label.label = `<a href="muzika:playlist:${settings.playlistId}">${playlist_name}</a>`;
    } else {
      this._playlist_label.label = playlist_name;
    }

    this._playlist_label.tooltip_text = settings?.playlist ?? _("Queue");

    this.params_map.clear();

    let first_param: Gtk.Widget | null = null;

    while ((first_param = this._params_box.get_first_child())) {
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

  activate_cb() {}

  vfunc_map(): void {
    this._list_view.scroll_to(
      this.player.queue.position,
      Gtk.ListScrollFlags.NONE,
      null,
    );
    super.vfunc_map();
  }
}
