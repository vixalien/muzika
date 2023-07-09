import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { LyricsView } from "./lyrics";
import { QueueView } from "./queue";
import { Player } from "src/player";
import { RelatedView } from "./related";
import { MuzikaPlayer } from "src/player/muzika";

export class PlayerSidebar extends Adw.Bin {
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

  private _stack = new Gtk.Stack({
    vhomogeneous: false,
    transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
  });
  private _header = Adw.HeaderBar.new();
  private _toolbar_view = new Adw.ToolbarView({ content: this._stack });

  constructor(options: PlayerSidebarOptions) {
    super();

    this._toolbar_view.add_top_bar(this._header);
    this.child = this._toolbar_view;

    const queue_view = new QueueView(options);
    const lyrics_view = new LyricsView(options);
    const related_view = new RelatedView(options);

    options.player.queue.connect("notify::settings", () => {
      if (this._stack.visible_child === lyrics_view) {
        lyrics_view.load_lyrics();
      } else if (this._stack.visible_child === related_view) {
        related_view.load_related();
      }
    });

    this._stack.add_child(queue_view);
    this._stack.add_child(lyrics_view);
    this._stack.add_child(related_view);

    this.views.set(PlayerSidebarView.QUEUE, queue_view);
    this.views.set(PlayerSidebarView.LYRICS, lyrics_view);
    this.views.set(PlayerSidebarView.RELATED, related_view);
  }

  show_view(view: PlayerSidebarView) {
    this._stack.set_visible_child(this.views.get(view)!);

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
    const child = this._stack.get_visible_child();

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
  player: MuzikaPlayer;
}
