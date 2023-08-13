import GLib from "gi://GLib";

import { SearchContent } from "src/muse";

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

export function flat_view_activate_cb<View extends FlatGridView | FlatListView>(
  view: View,
  position: number,
) {
  const item = view.items.get_item(position)?.object;

  if (!item) return;

  let uri: string | null = null;

  switch (view.child_type) {
    case FlatViewChildType.MIXED_CARD:
      const child = item as MixedCardItem;
      switch (child.type) {
        case "playlist":
        case "watch-playlist":
          uri = `playlist:${child.playlistId}`;
          break;
        case "artist":
          uri = `artist:${child.browseId}`;
          break;
        case "album":
          uri = `album:${child.browseId}`;
          break;
        case "inline-video":
        case "song":
        case "video":
        case "flat-song":
          if (child.videoId) {
            view.activate_action(
              "queue.play-song",
              GLib.Variant.new_string(
                child.videoId,
              ),
            );
          }
          break;
      }
      break;
    case FlatViewChildType.INLINE_SONG:
      const song = item as InlineSong;
      if (song.videoId) {
        view.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(
            song.videoId,
          ),
        );
      }
      break;
    case FlatViewChildType.SEARCH_CONTENT:
      const search_content = item as SearchContent;

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

  let uri: string | null = null;

  switch (item.type) {
    case "playlist":
    case "watch-playlist":
      uri = `playlist:${item.playlistId}`;
      break;
    case "artist":
      uri = `artist:${item.browseId}`;
      break;
    case "album":
      uri = `album:${item.browseId}`;
      break;
    case "inline-video":
    case "song":
    case "video":
    case "flat-song":
      if (item.videoId) {
        view.activate_action(
          "queue.play-song",
          GLib.Variant.new_string(
            item.videoId,
          ),
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

export function mood_activate_cb(view: CarouselMoodView, position: number) {
  const container = view.items.get_item(position);

  const params = container?.object.params;

  if (!params) return;

  view.activate_action(
    "navigator.visit",
    GLib.Variant.new_string("muzika:mood-playlists:" + params),
  );
}
