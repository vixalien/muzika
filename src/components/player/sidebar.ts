import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { LyricsView } from "./lyrics";
import { QueueView } from "./queue";
import { Player } from "src/player";
import { Queue } from "src/player/queue";

export class PlayerSidebar extends Gtk.Stack {
  static {
    GObject.registerClass({
      GTypeName: "PlayerSidebar",
      Properties: {
        "queue-view": GObject.ParamSpec.object(
          "queue-view",
          "Queue View",
          "The view which displays the queue",
          GObject.ParamFlags.READWRITE,
          GObject.Object.$gtype,
        ),
        "lyrics-view": GObject.ParamSpec.object(
          "lyrics-view",
          "Lyrics View",
          "The view which displays the lyrics",
          GObject.ParamFlags.READWRITE,
          GObject.Object.$gtype,
        ),
      },
    }, this);
  }

  views: Map<PlayerSidebarView, Gtk.Widget> = new Map();

  constructor(options: PlayerSidebarOptions) {
    super({
      vhomogeneous: false,
      transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
    });

    const queue_view = new QueueView(options);
    const lyrics_view = new LyricsView(options);

    this.add_child(queue_view);
    this.add_child(lyrics_view);

    this.views.set(PlayerSidebarView.QUEUE, queue_view);
    this.views.set(PlayerSidebarView.LYRICS, lyrics_view);
  }

  show_view(view: PlayerSidebarView) {
    this.set_visible_child(this.views.get(view)!);
  }

  get_selected_view(): PlayerSidebarView {
    const child = this.get_visible_child();

    for (const [view, widget] of this.views) {
      if (widget === child) {
        return view;
      }
    }

    return PlayerSidebarView.NONE;
  }
}

export enum PlayerSidebarView {
  NONE = 0,
  QUEUE = 1,
  LYRICS,
}

export interface PlayerSidebarOptions {
  player: Player;
  queue: Queue;
}
