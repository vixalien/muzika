import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";

import { LyricsView } from "./lyrics";
import { QueueView } from "./queue";
import { Player } from "src/player";
import { RelatedView } from "./related";

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
          QueueView.$gtype,
        ),
        "lyrics-view": GObject.ParamSpec.object(
          "lyrics-view",
          "Lyrics View",
          "The view which displays the lyrics",
          GObject.ParamFlags.READWRITE,
          LyricsView.$gtype,
        ),
        "related-view": GObject.ParamSpec.object(
          "related-view",
          "Related View",
          "The view which displays the related songs",
          GObject.ParamFlags.READWRITE,
          RelatedView.$gtype,
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
    const related_view = new RelatedView(options);

    options.player.queue.connect("notify::settings", () => {
      if (this.visible_child === lyrics_view) {
        lyrics_view.load_lyrics();
      } else if (this.visible_child === related_view) {
        related_view.load_related();
      }
    });

    this.add_child(queue_view);
    this.add_child(lyrics_view);
    this.add_child(related_view);

    this.views.set(PlayerSidebarView.QUEUE, queue_view);
    this.views.set(PlayerSidebarView.LYRICS, lyrics_view);
    this.views.set(PlayerSidebarView.RELATED, related_view);
  }

  show_view(view: PlayerSidebarView) {
    this.set_visible_child(this.views.get(view)!);

    if (view === PlayerSidebarView.LYRICS) {
      const lyrics_view = this.views.get(view)! as LyricsView;
      lyrics_view.load_lyrics();
    } else if (view === PlayerSidebarView.RELATED) {
      const related_view = this.views.get(view)! as RelatedView;
      related_view.load_related()
        .catch(console.log);
    }
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
  RELATED,
}

export interface PlayerSidebarOptions {
  player: Player;
}
