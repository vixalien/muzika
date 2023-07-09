import { get_queue, get_queue_ids, QueueOptions } from "src/muse";
import { omit } from "lodash-es";

import { QueueSettings } from "./queue";
import type { QueueTrack } from "libmuse/types/parsers/queue";

function create_cache_map<T extends any>() {
  return new Map<string, T>();
}

const cache_maps = {
  track_settings: create_cache_map<QueueSettings>(),
  queue_tracks: create_cache_map<QueueTrack>(),
  songs: create_cache_map<QueueTrack>(),
};

/**
 * track_settings are additional metadata about the track
 * it includes stuff like the lyrics, related info etc
 */
export async function get_track_settings(
  video_id: string,
  signal?: AbortSignal,
) {
  if (!cache_maps.track_settings.has(video_id)) {
    const queue = await get_queue(video_id, null, { signal });

    cache_maps.track_settings.set(video_id, omit(queue, ["tracks"]));

    for (const track of queue.tracks) {
      cache_maps.queue_tracks.set(
        track.videoId,
        track,
      );
    }
  }

  return cache_maps.track_settings.get(video_id)!;
}

/**
 * a queue track is a distinct track in the queue
 */
export async function get_tracklist(video_ids: string[]) {
  if (video_ids.every((id) => cache_maps.queue_tracks.has(id))) {
    return video_ids.map((id) => cache_maps.queue_tracks.get(id)!);
  }

  const tracks = await get_queue_ids(video_ids);

  for (const track of tracks) {
    cache_maps.queue_tracks.set(
      track.videoId,
      track,
    );
  }

  return tracks;
}

export async function get_track_queue(
  video_id: string,
  options: QueueOptions = {},
) {
  const queue = await get_queue(video_id, null, options);

  for (const track of queue.tracks) {
    cache_maps.queue_tracks.set(
      track.videoId,
      track,
    );
  }

  return queue;
}

export async function get_song(videoId: string) {
  if (!cache_maps.songs.has(videoId)) {
    cache_maps.songs.set(videoId, await get_song(videoId));
  }

  return cache_maps.songs.get(videoId)!;
}
