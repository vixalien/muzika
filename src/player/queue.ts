import GObject from "gi://GObject";
import Gio from "gi://Gio";

import { get_queue, Queue as MuseQueue } from "../muse.js";
import { ObjectContainer } from "../util/objectcontainer.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";

export type TrackOptions = Omit<MuseQueue, "tracks" | "continuation">;

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
      },
    }, this);
  }

  private _list: Gio.ListStore<ObjectContainer<QueueTrack>> = new Gio
    .ListStore();

  get list() {
    return this._list;
  }

  clear() {
    this._list.remove_all();
    this.change_position(-1);
  }

  get current() {
    if (this.position < 0 || this.position >= this.list.n_items) return null;
    return this.list.get_item(this.position);
  }

  get can_play_next() {
    return this.position < this.list.n_items - 1;
  }

  get can_play_previous() {
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

  private options?: TrackOptions;

  private set_queue_options(queue: MuseQueue) {
    this.options = _omit(queue, ["tracks", "continuation"]);
  }

  private _track_options_cache = new Map<string, TrackOptions>();

  get track_options_cache() {
    return this._track_options_cache;
  }

  constructor() {
    super();
  }

  async get_track_options(video_id: string) {
    if (!this.track_options_cache.has(video_id)) {
      const queue = await get_queue(video_id, null);

      this.track_options_cache.set(
        video_id,
        _omit(queue, ["tracks", "continuation"]),
      );
    }

    return this.track_options_cache.get(video_id)!;
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

    if (options.next) {
      this.play_next(queue);
    } else {
      this.add(queue);
    }
  }

  async add_songs(song_ids: string[], options: AddPlaylistOptions = {}) {
    const song_queues = await Promise.all(
      song_ids.map((song_id) => get_queue(song_id, null, options)),
    );

    if (options.next) {
      song_queues.forEach((queue) => this.play_next(queue));
    } else {
      song_queues.forEach((queue) => this.add(queue));
    }
  }

  async play_playlist(...options: Parameters<Queue["add_playlist"]>) {
    this.clear();
    await this.add_playlist(...options);
  }

  async play_songs(...options: Parameters<Queue["add_songs"]>) {
    this.clear();
    await this.add_songs(...options);
  }

  async play_song(song_id: string, signal?: AbortSignal) {
    const song_queue = await get_queue(song_id, null, {
      signal,
      radio: true,
    });

    this.clear();

    this.add(song_queue, true);
  }

  next(): QueueTrack | null {
    if (this.position >= this.list.n_items) return null;

    this.increment_position(1);
    return this.list.get_item(this.position)?.item!;
  }

  previous(): QueueTrack | null {
    if (this.position <= 0) return null;

    this.increment_position(-1);
    return this.list.get_item(this.position)?.item!;
  }

  private add_queue_at_position(
    queue: MuseQueue,
    position: number,
    set_options = false,
  ) {
    if (set_options) this.set_queue_options(queue);

    this.list.splice(
      position,
      0,
      queue.tracks.map((song) => ObjectContainer.new(song)),
    );
  }

  private play_next(queue: MuseQueue, set_options?: boolean) {
    this.add_queue_at_position(queue, this.position + 1, set_options);
  }

  private add(queue: MuseQueue, set_options?: boolean) {
    this.add_queue_at_position(queue, this.list.n_items, set_options);
  }
}

interface AddPlaylistOptions {
  shuffle?: boolean;
  next?: boolean;
  signal?: AbortSignal;
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
