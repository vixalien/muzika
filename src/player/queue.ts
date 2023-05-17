import GObject from "gi://GObject";
import Gio from "gi://Gio";

import {
  get_queue,
  get_queue_ids,
  Queue as MuseQueue,
  QueueOptions,
} from "../muse.js";
import { ObjectContainer } from "../util/objectcontainer.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { AddActionEntries } from "src/util/action.js";

export type QueueSettings = Omit<MuseQueue, "tracks">;

export enum RepeatMode {
  NONE = 0,
  ALL = 1,
  ONE = 2,
}

// Durstenfeld's modification of Fisher-Yates shuffle
function durstenfeld_shuffle<T extends any>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

export class Queue extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "Queue",
      Properties: {
        history: GObject.param_spec_object(
          "history",
          "History",
          "A Gio.ListStore that stores all the previously played songs",
          Gio.ListStore.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        list: GObject.param_spec_object(
          "list",
          "List",
          "A Gio.ListStore that stores all the songs",
          Gio.ListStore.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        position: GObject.param_spec_int(
          "position",
          "Position",
          "The current position in the queue",
          0,
          1000000,
          0,
          GObject.ParamFlags.READABLE,
        ),
        current: GObject.param_spec_object(
          "current",
          "Current",
          "The current song",
          ObjectContainer.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        "can-play-next": GObject.param_spec_boolean(
          "can-play-next",
          "Can play next",
          "Whether the next song can be played",
          false,
          GObject.ParamFlags.READABLE,
        ),
        "can-play-previous": GObject.param_spec_boolean(
          "can-play-previous",
          "Can play previous",
          "Whether the previous song can be played",
          false,
          GObject.ParamFlags.READABLE,
        ),
        repeat: GObject.param_spec_uint(
          "repeat",
          "Repeat",
          "The repeat mode",
          0,
          2,
          0,
          GObject.ParamFlags.READWRITE,
        ),
        shuffle: GObject.param_spec_boolean(
          "shuffle",
          "Shuffle",
          "Whether the queue is shuffled",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        settings: GObject.param_spec_object(
          "settings",
          "Settings",
          "The current queue settings",
          GObject.TYPE_OBJECT,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "wants-to-play": {},
      },
    }, this);
  }

  private _list: Gio.ListStore<ObjectContainer<QueueTrack>> = new Gio
    .ListStore();
  // original is used to store unshuffled list
  private _original: Gio.ListStore<ObjectContainer<QueueTrack>> = new Gio
    .ListStore();

  get list() {
    return this._list;
  }

  clear() {
    this._original.remove_all();
    this._list.remove_all();
    this.change_position(-1);
  }

  get current() {
    if (this.position < 0 || this.position >= this.list.n_items) return null;
    return this.list.get_item(this.position);
  }

  get can_play_next() {
    if (this.repeat === RepeatMode.ALL) return true;
    return this.position < this.list.n_items - 1;
  }

  get can_play_previous() {
    if (this.repeat === RepeatMode.ALL) return true;
    return this.position > 0;
  }

  private _position = -1;

  get position() {
    return this._position;
  }

  private change_position(position: number) {
    this._position = position;
    this.notify("position");
    this.notify("current");
    this.notify("can-play-next");
    this.notify("can-play-previous");
  }

  private increment_position(n: number) {
    this.change_position(this.position + n);
  }

  private _settings?: QueueSettings;

  get settings() {
    return this._settings;
  }

  private set_settings(settings: QueueSettings) {
    this.notify("settings");
    this._settings = settings;
  }

  private _shuffle = false;

  get shuffle() {
    return this._shuffle;
  }

  set shuffle(shuffled: boolean) {
    this._shuffle = shuffled;
    this.notify("shuffle");

    if (shuffled) {
      this._original.remove_all();

      const items = this._get_items(this._list);

      // store the items into original
      for (const item of items) {
        this._original.append(item);
      }

      // add the items back to the list
      this._list.splice(
        this.position + 1,
        items.length - this.position - 1,
        durstenfeld_shuffle(items.slice(this.position + 1)),
      );
    } else {
      const items = this._get_items(this._original);

      this._list.splice(
        this.position + 1,
        items.length - this.position - 1,
        items.slice(this.position + 1),
      );

      this._original.remove_all();
    }
  }

  /**
   * A helper to turn a `Gio.ListStore` into an array
   */
  private _get_items(list: Gio.ListStore<ObjectContainer<QueueTrack>>) {
    const items: ObjectContainer<QueueTrack>[] = [];

    for (let i = 0; i < list.n_items; i++) {
      const item = list.get_item(i);
      if (!item) continue;
      items.push(item);
    }

    return items;
  }

  constructor() {
    super();
  }

  get_action_group() {
    const action_group = Gio.SimpleActionGroup.new();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "toggle-repeat",
        activate: () => {
          this.toggle_repeat();
        },
      },
      {
        name: "toggle-shuffle",
        activate: () => {
          this.shuffle = !this.shuffle;
        },
      },
      {
        name: "play-playlist",
        parameter_type: "s",
        activate: (_, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()[0]}`);
          const params = url.searchParams;

          this.play_playlist(url.pathname, params.get("video") ?? undefined, {
            shuffle: params.has("shuffle"),
          });
        },
      },
      {
        name: "add-playlist",
        parameter_type: "s",
        activate: (_, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()}`);
          const params = url.searchParams;

          this.add_playlist(url.pathname, params.get("video") ?? undefined, {
            next: params.has("next"),
            shuffle: params.has("shuffle"),
          });
        },
      },
      {
        name: "play-song",
        parameter_type: "s",
        activate: (_, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()[0]}`);
          const params = url.searchParams;

          const ids = url.pathname.split(",");

          if (ids.length == 1) {
            this.play_song(ids[0]);
          } else {
            this.play_songs(url.pathname.split(","), {
              shuffle: params.has("shuffle"),
            });
          }
        },
      },
      {
        name: "add-playlist",
        parameter_type: "s",
        activate: (_, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()}`);
          const params = url.searchParams;

          this.add_songs(url.pathname.split(","), {
            next: params.has("next"),
            shuffle: params.has("shuffle"),
          });
        },
      },
    ]);

    return action_group;
  }

  // property: repeat

  repeat = RepeatMode.NONE;

  toggle_repeat() {
    this.repeat = (this.repeat + 1) % 3;

    this.notify("can-play-next");
    this.notify("can-play-previous");
  }

  /**
   * This functions gets and caches the track
   */
  private async get_track_queue(
    video_id: string,
    options: QueueOptions = {},
  ) {
    const queue = await get_queue(video_id, null, options);

    this.track_options_settings.set(video_id, _omit(queue, ["tracks"]));

    for (const track of queue.tracks) {
      this.tracklist_map.set(
        track.videoId,
        track,
      );
    }

    return queue;
  }

  // queue track is a distinct track in the queue

  private tracklist_map = new Map<string, QueueTrack>();

  private async get_tracklist(video_ids: string[]) {
    if (video_ids.every((id) => this.tracklist_map.has(id))) {
      return video_ids.map((id) => this.tracklist_map.get(id)!);
    }

    const tracks = await get_queue_ids(video_ids);

    for (const track of tracks) {
      this.tracklist_map.set(
        track.videoId,
        track,
      );
    }

    return tracks;
  }

  // track options is the specific option for a queue track
  // it includes stuff like the lyrics, related info etc

  private track_options_settings = new Map<string, QueueSettings>();

  async get_track_settings(video_id: string) {
    if (!this.track_options_settings.has(video_id)) {
      const queue = await get_queue(video_id, null);

      this.track_options_settings.set(video_id, _omit(queue, ["tracks"]));

      for (const track of queue.tracks) {
        this.tracklist_map.set(
          track.videoId,
          track,
        );
      }
    }

    return this.track_options_settings.get(video_id)!;
  }

  async add_playlist(
    playlist_id: string,
    video_id?: string,
    options: AddPlaylistOptions = {},
  ) {
    const queue = await get_queue(video_id ?? null, playlist_id, {
      shuffle: options.shuffle ?? false,
      signal: options.signal,
    });

    if (options.play) {
      this.clear();
    }

    if (options.next) {
      this.play_next(queue.tracks, queue.current?.index);
    } else {
      this.add(queue.tracks, queue.current?.index);
    }

    if (options.play) {
      this.set_settings(_omit(queue, ["tracks"]));
      this.emit("wants-to-play");
      this.change_position(queue.current?.index ?? 0);
    }
  }

  async add_songs(song_ids: string[], options: AddPlaylistOptions = {}) {
    let tracks: QueueTrack[], first_track_options: QueueSettings | undefined;

    if (song_ids.length === 1) {
      // fast path to get the track options and tracklist at the same time
      const queue = await this.get_track_queue(song_ids[0]);

      tracks = queue.tracks;
      first_track_options = _omit(queue, ["tracks"]);
    } else {
      [tracks, first_track_options] = await Promise.all([
        this.get_tracklist(song_ids).then((tracks) => tracks ?? []),
        options.play ? this.get_track_settings(song_ids[0]) : undefined,
      ]);
    }

    if (options.play) {
      this.clear();
    }

    if (options.next) {
      this.play_next(tracks);
    } else {
      this.add(tracks);
    }

    if (first_track_options) {
      this.set_settings(first_track_options);
    }

    if (options.play) {
      this.emit("wants-to-play");
      this.change_position(0);
    }
  }

  async play_playlist(...options: Parameters<Queue["add_playlist"]>) {
    await this.add_playlist(options[0], options[1], {
      ...options[2],
      play: true,
    });
  }

  async play_songs(...options: Parameters<Queue["add_songs"]>) {
    await this.add_songs(options[0], {
      ...options[1],
      play: true,
    });
  }

  async play_song(song_id: string, signal?: AbortSignal) {
    await this.play_songs([song_id], { signal });
  }

  next(): QueueTrack | null {
    if (this.repeat === RepeatMode.ALL) {
      if (this.position >= this.list.n_items - 1) {
        this.change_position(0);
      } else {
        this.increment_position(1);
      }

      return this.list.get_item(this.position)?.item!;
    } else {
      if (this.position >= this.list.n_items - 1) return null;

      this.increment_position(1);
      return this.list.get_item(this.position)?.item!;
    }
  }

  repeat_or_next() {
    if (this.repeat === RepeatMode.ONE) {
      this.change_position(this.position);
      return this.list.get_item(this.position)?.item!;
    } else {
      return this.next();
    }
  }

  previous(): QueueTrack | null {
    if (this.repeat === RepeatMode.ALL) {
      if (this.position <= 0) {
        this.change_position(this.list.n_items - 1);
      } else {
        this.increment_position(-1);
      }

      return this.list.get_item(this.position)?.item!;
    } else {
      if (this.position <= 0) return null;

      this.increment_position(-1);
      return this.list.get_item(this.position)?.item!;
    }
  }

  private add_queue_at_position(
    tracks: QueueTrack[],
    position: number,
    new_position?: number,
  ) {
    this.list.splice(
      position,
      0,
      tracks.map((song) => ObjectContainer.new(song)),
    );

    if (this.shuffle) {
      this._original.splice(
        position,
        0,
        tracks.map((song) => ObjectContainer.new(song)),
      );
    }

    if (new_position != null) {
      this.change_position(new_position);
    } else if (this.position < 0) {
      this.change_position(0);
    } else {
      this.notify("can-play-previous");
      this.notify("can-play-next");
    }
  }

  private play_next(tracks: QueueTrack[], new_position?: number) {
    this.add_queue_at_position(tracks, this.position + 1, new_position);
  }

  private add(tracks: QueueTrack[], new_position?: number) {
    this.add_queue_at_position(tracks, this.list.n_items, new_position);
  }
}

interface AddPlaylistOptions {
  shuffle?: boolean;
  next?: boolean;
  signal?: AbortSignal;
  play?: boolean;
}

function _omit<Object extends Record<string, any>, Key extends keyof Object>(
  object: Object,
  keys: Key[],
): Omit<Object, Key> {
  const new_object = { ...object };
  for (const key of keys) {
    delete new_object[key];
  }
  return new_object;
}
