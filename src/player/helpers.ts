import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";

import { RepeatMode } from "./queue";
import { get_player } from "src/application";
import { escape_label, pretty_subtitles } from "src/util/text";

// function create_cache_map<T extends any>() {
//   return new Map<string, T>();
// }

// const cache_maps = {
//   track_settings: create_cache_map<QueueSettings>(),
//   queue_tracks: create_cache_map<QueueTrack>(),
//   songs: create_cache_map<QueueTrack>(),
// };

// /**
//  * track_settings are additional metadata about the track
//  * it includes stuff like the lyrics, related info etc
//  */
// export async function get_track_settings(
//   video_id: string,
//   signal?: AbortSignal,
// ) {
//   if (!cache_maps.track_settings.has(video_id)) {
//     if (cache_maps.queue_tracks.has(video_id)) {
//       return cache_maps.queue_tracks.get(video_id) as QueueSettings | undefined;
//     }

//     const queue = await get_queue(video_id, null, { signal, autoplay: false });

//     cache_maps.track_settings.set(video_id, omit(queue, ["tracks"]));

//     for (const track of queue.tracks) {
//       cache_maps.queue_tracks.set(track.videoId, track);
//     }
//   }

//   return cache_maps.track_settings.get(video_id)!;
// }

// /**
//  * a queue track is a distinct track in the queue
//  */
// export async function get_tracklist(video_ids: string[]) {
//   if (video_ids.every((id) => cache_maps.queue_tracks.has(id))) {
//     return video_ids.map((id) => cache_maps.queue_tracks.get(id)!);
//   }

//   const tracks = await get_queue_tracks(video_ids);

//   for (const track of tracks) {
//     cache_maps.queue_tracks.set(track.videoId, track);
//   }

//   return tracks;
// }

// export async function get_track_queue(
//   video_id: string,
//   options: QueueOptions = {},
// ) {
//   const queue = await get_queue(video_id, null, options);

//   for (const track of queue.tracks) {
//     cache_maps.queue_tracks.set(track.videoId, track);
//   }

//   return queue;
// }

// export async function get_song(videoId: string, signal?: AbortSignal) {
//   if (!cache_maps.songs.has(videoId)) {
//     cache_maps.songs.set(videoId, await get_song(videoId, signal));
//   }

//   return cache_maps.songs.get(videoId)!;
// }

export function bind_repeat_button(button: Gtk.ToggleButton) {
  const queue = get_player().queue;

  return [
    // @ts-expect-error incorrect types
    queue.bind_property_full(
      "repeat",
      button,
      "icon-name",
      GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      () => {
        let icon = "image-missing-symbolic";

        switch (queue.repeat) {
          case RepeatMode.ALL:
            icon = "media-playlist-repeat-symbolic";
            break;
          case RepeatMode.ONE:
            icon = "media-playlist-repeat-song-symbolic";
            break;
          case RepeatMode.NONE:
            icon = "media-playlist-consecutive-symbolic";
            break;
        }

        return [true, icon];
      },
      null,
    ),

    // @ts-expect-error incorrect types
    queue.bind_property_full(
      "repeat",
      button,
      "tooltip-text",
      GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
      () => {
        let text: string;

        switch (queue.repeat) {
          case RepeatMode.ALL:
            text = _("Repeat All Songs");
            break;
          case RepeatMode.ONE:
            text = _("Repeat the Current Song");
            break;
          case RepeatMode.NONE:
            text = _("Enable Repeat");
            break;
        }

        if (!text) return [false];

        return [true, text];
      },
      null,
    ),
  ];
}

export function bind_play_icon(image: Gtk.Image | Gtk.Button) {
  const player = get_player();

  // @ts-expect-error incorrect types
  return player.bind_property_full(
    "playing",
    image,
    "icon-name",
    GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
    () => {
      return [
        true,
        player.playing
          ? "media-playback-pause-symbolic"
          : "media-playback-start-symbolic",
      ];
    },
    null,
  );
}

export function bind_track_title(label: Gtk.Label) {
  const player = get_player();

  return [
    // @ts-expect-error incorrect types
    player.queue.bind_property_full(
      "current",
      label,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      () => {
        const track = player.queue.current?.object;
        if (!track) return [false, null];

        if (track.album) {
          return [
            true,
            `<a href="muzika:album:${track.album.id}?track=${track.videoId}">${escape_label(
              track.title,
            )}</a>`,
          ];
        }

        return [true, escape_label(track.title)];
      },
      null,
    ),
    // @ts-expect-error incorrect types
    player.queue.bind_property_full(
      "current",
      label,
      "tooltip-text",
      GObject.BindingFlags.SYNC_CREATE,
      () => {
        const track = player.queue.current?.object;
        if (!track) return [false, null];

        return [true, escape_label(track.title)];
      },
      null,
    ),
  ];
}

export function bind_track_artists(label: Gtk.Label) {
  const player = get_player();

  return [
    // @ts-expect-error incorrect types
    player.queue.bind_property_full(
      "current",
      label,
      "label",
      GObject.BindingFlags.SYNC_CREATE,
      () => {
        const track = player.queue.current?.object;
        if (!track) return [false, null];

        return [true, pretty_subtitles(track.artists).markup];
      },
      null,
    ),
    // @ts-expect-error incorrect types
    player.queue.bind_property_full(
      "current",
      label,
      "tooltip-text",
      GObject.BindingFlags.SYNC_CREATE,
      () => {
        const track = player.queue.current?.object;
        if (!track) return [false, null];

        return [true, pretty_subtitles(track.artists).plain];
      },
      null,
    ),
  ];
}
