import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import Adw from "gi://Adw";

import { LyricsView } from "./lyrics";
import { QueueView } from "./queue";
import { RelatedView } from "./related";
import { get_player } from "src/application";

// make sure to first register these
GObject.type_ensure(LyricsView.$gtype);
GObject.type_ensure(QueueView.$gtype);
GObject.type_ensure(RelatedView.$gtype);

export class PlayerNowPlayingDetails extends Adw.NavigationPage {
  static {
    GObject.registerClass({
      GTypeName: "PlayerNowPlayingDetails",
      Template:
        "resource:///com/vixalien/muzika/ui/components/player/now-playing-details.ui",
      InternalChildren: ["stack"],
    }, this);
  }

  private _stack!: Gtk.Stack;

  constructor() {
    super();

    const player = get_player();

    player.queue.connect("notify::settings", () => {
      if (this._stack.visible_child_name === "lyrics") {
        (this.get_view(PlayerSidebarView.LYRICS) as LyricsView)?.load_lyrics();
      } else if (this._stack.visible_child_name === "related") {
        (this.get_view(PlayerSidebarView.RELATED) as RelatedView)
          ?.load_related();
      }
    });
  }

  private get_view(view: PlayerSidebarView) {
    if (view === PlayerSidebarView.NONE) return null;
    return this._stack.get_child_by_name(view);
  }

  show_view(view: PlayerSidebarView) {
    if (view === PlayerSidebarView.NONE) return;

    this._stack.set_visible_child_name(view);
    this.set_title(get_view_title(view) ?? _("Queue"));

    if (view === PlayerSidebarView.LYRICS) {
      (this.get_view(PlayerSidebarView.LYRICS) as LyricsView)?.load_lyrics();
    } else if (view === PlayerSidebarView.RELATED) {
      (this.get_view(PlayerSidebarView.RELATED) as RelatedView)
        ?.load_related();
    }
  }
}

export enum PlayerSidebarView {
  NONE = 0,
  QUEUE = "queue",
  LYRICS = "lyrics",
  RELATED = "related",
}

function get_view_title(view: PlayerSidebarView) {
  switch (view) {
    case PlayerSidebarView.NONE:
      return null;
    case PlayerSidebarView.QUEUE:
      return _("Queue");
    case PlayerSidebarView.LYRICS:
      return _("Lyrics");
    case PlayerSidebarView.RELATED:
      return _("Related");
  }
}
