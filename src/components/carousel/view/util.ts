import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import type { SearchContent } from "libmuse";

import { MixedCardItem } from "src/components/library/mixedcard";
import { FlatGridView } from "./flatgrid";
import { FlatListView } from "./flatlist";
import { InlineSong } from "../flatcard";
import { CarouselGridView } from "./grid";
import { CarouselListView } from "./list";
import { CarouselMoodView } from "./mood";

export enum FlatViewChildType {
  INLINE_SONG = 0,
  SEARCH_CONTENT,
  MIXED_CARD,
}

function activate_inline_song(view: Gtk.Widget, song: InlineSong) {
  if (song.videoId) {
    view.activate_action(
      "queue.play-song",
      GLib.Variant.new_string(song.videoId),
    );
  }
}

function activate_search_content(
  view: Gtk.Widget,
  search_content: SearchContent,
) {
  let uri: string | null = null;

  switch (search_content.type) {
    case "playlist":
      uri = `playlist:${search_content.browseId}`;
      break;
    case "artist":
      uri = `artist:${search_content.browseId}`;
      break;
    case "profile":
      uri = `channel:${search_content.browseId}`;
      break;
    case "album":
      uri = `album:${search_content.browseId}`;
      break;
    case "radio":
      view.activate_action(
        "queue.play-playlist",
        GLib.Variant.new_string(
          `${search_content.playlistId}?video=${search_content.videoId}`,
        ),
      );
      break;
    case "song":
    case "video":
      view.activate_action(
        "queue.play-song",
        GLib.Variant.new_string(search_content.videoId),
      );
      break;
  }

  if (uri) {
    view.activate_action(
      "navigator.visit",
      GLib.Variant.new_string("muzika:" + uri),
    );
  }
}

export function flat_view_activate_cb<View extends FlatGridView | FlatListView>(
  view: View,
  position: number,
) {
  const item = view.items.get_item(position)?.object;

  if (!item) return;

  switch (view.child_type) {
    case FlatViewChildType.MIXED_CARD:
      return activate_mixed_card(view, item as MixedCardItem);
    case FlatViewChildType.INLINE_SONG:
      return activate_inline_song(view, item as InlineSong);
    case FlatViewChildType.SEARCH_CONTENT:
      return activate_search_content(view, item as SearchContent);
  }
}

function activate_mixed_card(view: Gtk.Widget, item: MixedCardItem) {
  let uri: string | null = null;

  switch (item.type) {
    case "playlist":
    case "watch-playlist":
      uri = `playlist:${item.playlistId}`;
      break;
    case "artist":
    // library channels are music channels
    // eslint-disable-next-line no-fallthrough
    case "channel":
      uri = `artist:${item.browseId}`;
      break;
    case "album":
      uri = `album:${item.browseId}`;
      break;
    case "library-artist": {
      // remove MPLA prefix if it's there
      const id = item.browseId;
      if (id.startsWith("MPLA")) {
        uri = `artist:${item.browseId.slice(4)}`;
      } else {
        uri = `artist:${item.browseId}`;
      }
      break;
    }
    case "inline-video":
    case "song":
    case "video":
    case "flat-song":
      if (item.videoId) {
        view.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(item.videoId),
        );
      }
      break;
  }

  if (uri) {
    view.activate_action(
      "navigator.visit",
      GLib.Variant.new_string("muzika:" + uri),
    );
  }
}

export function mixed_card_activate_cb<
  View extends CarouselGridView | CarouselListView,
>(view: View, position: number) {
  const item = view.items.get_item(position)?.object;

  if (!item) return;

  return activate_mixed_card(view, item);
}

export function mood_activate_cb(view: CarouselMoodView, position: number) {
  const container = view.items.get_item(position);

  const params = container?.object.params;

  if (!params) return;

  view.activate_action(
    "navigator.visit",
    GLib.Variant.new_string("muzika:mood-playlists:" + params),
  );
}
