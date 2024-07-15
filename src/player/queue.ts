import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";

import { get_queue, get_queue_tracks } from "libmuse";
import type { Queue as MuseQueue, QueueTrack } from "libmuse";

import { ObjectContainer } from "../util/objectcontainer.js";
import { AddActionEntries, build_action } from "src/util/action.js";
import { Application } from "src/application.js";
import { list_model_to_array } from "src/util/list.js";
import { ngettext } from "gettext";
// import {
//   get_track_queue,
//   get_track_settings,
//   get_tracklist,
// } from "./helpers.js";
import { add_toast } from "src/util/window.js";
import { clone } from "lodash-es";

const vprintf = imports.format.vprintf;

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

export enum PreferredMediaType {
  AUTO = 0,
  SONG,
  VIDEO,
}

export class QueueChip extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "QueueChip",
      Properties: {
        "title": GObject.param_spec_string(
          "title",
          "Title",
          "The label of this chip",
          null,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ),
        "playlist-id": GObject.param_spec_string(
          "playlist-id",
          "Playlist ID",
          "The playlist ID this chip activates",
          null,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ),
        "params": GObject.param_spec_string(
          "params",
          "Params",
          "The unique params for this playlist",
          null,
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
        ),
      },
    }, this);
  }

  constructor(props: QueueChipsConstructorProperties) {
    super(props);
  }

  title!: string;
  playlist_id!: string;
  params!: string;
}

interface QueueChipsConstructorProperties {
  title: string;
  playlist_id: string;
  params: string;
}

export class Queue extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "Queue",
      Properties: {
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
        "active-chip": GObject.param_spec_string(
          "active-chip",
          "Active chip",
          "The active chip",
          null as any,
          GObject.ParamFlags.READWRITE,
        ),
        "preferred-media-type": GObject.param_spec_uint(
          "preferred-media-type",
          "The preferred media type",
          "Whether the users prefers to play tracks as-is, track or video versions",
          PreferredMediaType.AUTO,
          PreferredMediaType.VIDEO,
          PreferredMediaType.AUTO,
          GObject.ParamFlags.READWRITE,
        ),
        "current-is-video": GObject.param_spec_boolean(
          "current-is-video",
          "Current Is Video",
          "Whether the currently playing track has a video",
          false,
          GObject.ParamFlags.READABLE,
        ),
        "playlist-id": GObject.param_spec_string(
          "playlist-id",
          "Playlist ID",
          "The currently playing playlist ID",
          null,
          GObject.ParamFlags.READWRITE,
        ),
        "playlist-name": GObject.param_spec_string(
          "playlist-name",
          "Playlist Name",
          "The currently playing playlist's name",
          null,
          GObject.ParamFlags.READWRITE,
        ),
        chips: GObject.param_spec_object(
          "chips",
          "Chips",
          "The player chips based on different moods",
          Gtk.SingleSelection.$gtype,
          GObject.ParamFlags.READABLE,
        ),
      },
      Signals: {
        "play": {},
      },
    }, this);
  }

  preferred_media_type = PreferredMediaType.AUTO;

  private _list: Gio.ListStore<ObjectContainer<QueueTrack>> = new Gio
    .ListStore();
  // original is used to store unshuffled list
  _original: Gio.ListStore<ObjectContainer<QueueTrack>> = new Gio
    .ListStore();

  get list() {
    return this._list;
  }

  clear() {
    this._original.remove_all();
    this._list.remove_all();
    this.change_position(-1);
  }

  private get_correct_counterpart(track: ObjectContainer<QueueTrack> | null) {
    if (!track?.object.counterpart) return null;

    let correct_track: ObjectContainer<QueueTrack> | null = null;

    switch (this.preferred_media_type) {
      case PreferredMediaType.SONG: {
        if (is_track_video(track.object)) {
          correct_track = this.get_counterpart(track.object)!;
        }
        break;
      }
      case PreferredMediaType.VIDEO: {
        if (!is_track_video(track.object)) {
          correct_track = this.get_counterpart(track.object)!;
        }
        break;
      }
    }

    return correct_track;
  }

  private queue?: MuseQueue;

  set_queue(queue: MuseQueue) {
    this.queue = queue;
    const chips_model = this.chips.model as Gio.ListStore;

    chips_model.splice(
      0,
      chips_model.n_items,
      queue.chips.map((chip) => new QueueChip(chip as any)),
    );

    this.notify("playlist-id");
    this.notify("playlist-name");
  }

  get playlist_id() {
    return this.queue?.playlistId ?? null;
  }

  get playlist_name() {
    return this.queue?.playlist ?? null;
  }

  get current() {
    if (this.position < 0 || this.position >= this.list.n_items) return null;
    return this.list.get_item(this.position);
  }

  get current_is_video() {
    return this.current?.object?.videoType !== "MUSIC_VIDEO_TYPE_ATV";
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

  change_position(position: number, force = false) {
    if (position === -1) return null;

    if (position != this._position || force) {
      this._position = position;

      this.notify("position");
      this.notify("current");
      this.notify("current-is-video");
      this.notify("can-play-next");
      this.notify("can-play-previous");
    }
  }

  _shuffle = false;

  get shuffle() {
    return this._shuffle;
  }

  set shuffle(value: boolean) {
    if (value === this.shuffle) return;

    this._shuffle = value;
    this.notify("shuffle");

    if (value) {
      const items = list_model_to_array(this._list);

      // backup the items into original
      this._original.splice(
        0,
        this._original.n_items,
        items,
      );

      // add the items back to the list
      this._list.splice(
        this.position + 1,
        items.length - this.position - 1,
        durstenfeld_shuffle(items.slice(this.position + 1)),
      );
    } else {
      const items = list_model_to_array(this._original);

      this._list.splice(
        this.position + 1,
        items.length - this.position - 1,
        items.slice(this.position + 1),
      );

      this._original.remove_all();
    }
  }

  private _chips = new Gtk.SingleSelection<QueueChip>({
    model: Gio.ListStore.new(QueueChip.$gtype),
    can_unselect: true,
  });

  get chips() {
    return this._chips;
  }

  app: Application;

  constructor(options: { app: Application }) {
    super();

    this.app = options.app;

    this.chips.connect(
      "selection-changed",
      this.active_chip_changed_cb.bind(this),
    );
  }

  get_action_group() {
    const action_group = Gio.SimpleActionGroup.new();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "play-playlist",
        parameter_type: "s",
        activate: (_, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()[0]}`);
          const params = url.searchParams;

          return this.add_playlist_action_cb(
            url.pathname,
            params.get("video") ?? undefined,
            {
              next: params.has("next"),
              shuffle: params.has("shuffle"),
              play: true,
            },
          );
        },
      },
      {
        name: "add-playlist",
        parameter_type: "s",
        activate: async (__, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()[0]}`);
          const params = url.searchParams;

          return this.add_playlist_action_cb(
            url.pathname,
            params.get("video") ?? undefined,
            {
              next: params.has("next"),
              shuffle: params.has("shuffle"),
            },
          );
        },
      },
      {
        name: "play-song",
        parameter_type: "s",
        activate: (__, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()[0]}`);
          const params = url.searchParams;

          return this.add_song_action_cb(url.pathname.split(","), {
            next: params.has("next"),
            shuffle: params.has("shuffle"),
            play: true,
          });
        },
      },
      {
        name: "add-song",
        parameter_type: "s",
        activate: (__, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()[0]}`);
          const params = url.searchParams;

          return this.add_song_action_cb(url.pathname.split(","), {
            next: params.has("next"),
            shuffle: params.has("shuffle"),
          }).catch(console.error);
        },
      },
    ]);

    action_group.add_action(build_action({
      name: "toggle-repeat",
      parameter_type: null,
      state: GLib.Variant.new_boolean(false),
      activate: this.toggle_repeat.bind(this),
      bind_state_full: [this, "repeat", () => {
        return [
          true,
          GLib.Variant.new_boolean(
            this.repeat == RepeatMode.NONE ? false : true,
          ),
        ];
      }],
    }));

    action_group.add_action(build_action({
      name: "toggle-shuffle",
      parameter_type: null,
      state: GLib.Variant.new_boolean(false),
      activate: () => this.shuffle = !this.shuffle,
      bind_state_full: [this, "shuffle", () => {
        return [true, GLib.Variant.new_boolean(this.shuffle)];
      }],
    }));

    action_group.add_action(build_action({
      name: "previous",
      parameter_type: null,
      activate: () => this.previous(),
      bind_enabled: [this, "can-play-previous"],
    }));

    action_group.add_action(build_action({
      name: "next",
      parameter_type: null,
      activate: () => this.next(),
      bind_enabled: [this, "can-play-next"],
    }));

    action_group.add_action(build_action({
      name: "active-chip",
      parameter_type: GLib.VariantType.new("s"),
      activate: (_, param) => {
        const playlist_id = param.get_string()[0];

        if (playlist_id) this.change_active_chip(playlist_id);
      },
      state: GLib.Variant.new_string(this.get_active_chip()?.playlist_id ?? ""),
      bind_state_full: [this.chips, "selected-item", (_, chip) => {
        return [true, GLib.Variant.new_string(chip?.playlist_id)];
      }],
    }));

    return action_group;
  }

  // property: repeat

  repeat = RepeatMode.NONE;

  toggle_repeat() {
    this.repeat = (this.repeat + 1) % 3;

    this.notify("can-play-next");
    this.notify("can-play-previous");
  }

  private async active_chip_changed_cb() {
    if (!this.queue) return;

    const chip = this.chips.selected_item as QueueChip;

    if (chip) {
      const queue = await get_queue(null, chip.playlist_id, {
        params: chip.params,
      });

      this.add_tracks("remaining", queue.tracks);

      this.notify("can-play-previous");
      this.notify("can-play-next");
    }
  }

  /**
   * Add tracks to the queue
   * @param position where to add the queue.
   * - `next` tracks will be added after the currently playing track.
   * - `end` add tracks to the end of the queue
   * - `clear` removes all tracks and adds the following ones
   * - `remaining` removes all the next tracks and replaces them with the givens
   * @param tracks tracks to add
   */
  private add_tracks(
    position: number | "next" | "end" | "clear" | "remaining",
    tracks: QueueTrack[],
  ) {
    let insert: number, n_removals = 0;

    switch (position) {
      case "end":
        insert = this._list.n_items;
        break;
      case "next":
        insert = this.position + 1;
        break;
      case "clear":
        insert = 0;
        n_removals = this.list.n_items;
        break;
      case "remaining":
        insert = this.position + 1;
        n_removals = this.list.n_items - this.position - 1;
        break;
      default:
        insert = position;
        break;
    }

    this.list.splice(
      insert,
      n_removals,
      tracks.map((track) => new ObjectContainer(track)),
    );

    if (this.shuffle) {
      this._original.splice(
        insert,
        n_removals,
        tracks.map((track) => new ObjectContainer(track)),
      );
    }
  }

  async add_playlist2(
    playlist_id: string,
    video_id?: string,
    options: AddPlaylist2Options = {},
  ) {
    if (options.play) this.emit("play");

    const queue = await get_queue(video_id ?? null, playlist_id, {
      shuffle: options.shuffle,
      signal: options.signal,
      radio: options.radio,
    });

    if (options.play) {
      this.clear();
      this.preferred_media_type = PreferredMediaType.AUTO;
      this.set_queue(queue);
    }

    this.add_tracks(options.next ? "next" : "end", queue.tracks);

    if (options.play) {
      this.preferred_media_type = PreferredMediaType.AUTO;
      this.change_position(queue.current?.index ?? 0, true);
    }

    return queue;
  }

  async add_songs2(
    video_ids: string[],
    options: AddSong2Options = {},
  ): Promise<MuseQueue> {
    if (options.play) this.emit("play");

    let queue: MuseQueue, tracks: QueueTrack[] = [];

    // fast path to return both the queue and tracks at the same time
    // if there's no queue, instead of adding tracks just get a new queue
    if (video_ids.length == 1 || !this.queue) {
      queue = await get_queue(video_ids[0], null, { radio: options.radio });
    } else {
      // must already have a queue to add tracks
      if (!this.queue) return this.queue!;

      [queue, tracks] = await Promise.all([
        options.play ? get_queue(video_ids[0], null) : clone(this.queue!),
        // don't fetch the queue track again if it's only one. it will be got
        // from the above call
        video_ids.length === 1 ? [] : get_queue_tracks(video_ids),
      ]);

      queue.tracks.push(...tracks);
    }

    if (options.play && queue) this.set_queue(queue);

    this.add_tracks(
      options.play ? "clear" : options.next ? "next" : "end",
      queue.tracks,
    );

    if (options.play) {
      this.preferred_media_type = PreferredMediaType.AUTO;
      this.change_position(0, true);
    }

    return queue;
  }

  private async add_song_action_cb(
    video_ids: string[],
    options?: AddSong2Options,
  ) {
    if (options?.radio && this.current?.object.videoId === video_ids[0]) {
      // notify when starting radio, and the current track is playing already
      add_toast(_("Starting Radio"));
    }

    const queue = await this.add_songs2(video_ids, {
      ...options,
      play: options?.play ?? options?.radio,
    });

    if (!queue) return;

    const normalized_title = GLib.markup_escape_text(
      queue.tracks[0].title,
      -1,
    );

    if (options?.play) return;

    add_toast(
      options?.next
        ? ngettext(
          // Translators: %s is a song's name
          vprintf(_("Playing “%s” next"), [normalized_title]),
          vprintf(_("Playing %d songs next"), [queue.tracks.length]),
          queue.tracks.length,
        )
        : ngettext(
          // Translators: %s is a song's name
          vprintf(_("Added “%s” to queue"), [normalized_title]),
          vprintf(_("Added %d songs to queue"), [queue.tracks.length]),
          queue.tracks.length,
        ),
    );
  }

  private async add_playlist_action_cb(
    playlist_id: string,
    video_id?: string,
    options?: AddPlaylist2Options,
  ) {
    const queue = await this.add_playlist2(playlist_id, video_id, options);

    if (queue.playlistName) {
      if (options?.play) return;

      const normalized_title = GLib.markup_escape_text(
        queue.playlistName,
        -1,
      );

      add_toast(
        options?.next
          ? vprintf(_("Playing “%s” next"), [normalized_title])
          // Translators: %s is a playlist name
          : vprintf(_("Added “%s” to queue"), [normalized_title]),
      );
    }
  }

  peek_next(): [number, QueueTrack | null] {
    let position: number;

    if (this.repeat === RepeatMode.ALL) {
      if (this.position >= this.list.n_items - 1) {
        position = 0;
      } else {
        position = this.position + 1;
      }
    } else {
      if (this.position >= this.list.n_items - 1) {
        return [-1, null];
      } else {
        position = this.position + 1;
      }
    }

    return [position, this.update_counterpart()?.object ?? null];
  }

  next(): QueueTrack | null {
    const [position, track] = this.peek_next();

    if (position > -1) {
      this.change_position(position);
      this.emit("play");
    }

    return track;
  }

  peek_repeat_or_next(): [number, QueueTrack | null] {
    let position: number;

    if (this.repeat === RepeatMode.ONE) {
      position = this.position;
    } else {
      return this.peek_next();
    }

    return [position, this.list.get_item(position)?.object ?? null];
  }

  repeat_or_next(): QueueTrack | null {
    const [position, track] = this.peek_repeat_or_next();

    if (position > -1) {
      this.change_position(position);
      this.emit("play");
    }

    return track;
  }

  peek_previous(): [number, QueueTrack | null] {
    let position: number;

    if (this.repeat === RepeatMode.ALL) {
      if (this.position <= 0) {
        position = this.list.n_items - 1;
      } else {
        position = this.position - 1;
      }
    } else {
      if (this.position <= 0) return [-1, null];

      position = this.position - 1;
    }

    return [position, this.update_counterpart()?.object ?? null];
  }

  previous(): QueueTrack | null {
    const [position, track] = this.peek_previous();

    if (position > -1) {
      this.change_position(position);
      this.emit("play");
    }

    return track;
  }

  private get_counterpart(track: QueueTrack) {
    const counterpart = track.counterpart;

    if (!counterpart) return null;

    return new ObjectContainer(
      {
        ...counterpart,
        counterpart: {
          ...track,
          counterpart: null,
        },
      },
    );
  }

  switch_counterpart() {
    this.preferred_media_type = this.current_is_video
      ? PreferredMediaType.SONG
      : PreferredMediaType.VIDEO;

    this.update_counterpart();
  }

  private update_counterpart() {
    const item = this.list.get_item(this.position);

    const correct_item = this.get_correct_counterpart(item);

    if (correct_item) {
      this.list.splice(this.position, 1, [correct_item]);
      this.change_position(this.position, true);
    }

    return correct_item ?? item;
  }

  private change_active_chip(playlist_id: string) {
    const index = list_model_to_array(this.chips)
      .findIndex((chip) => {
        return chip.playlist_id === playlist_id;
      });

    if (index >= 0) {
      this.chips.select_item(index, true);
    }
  }

  private get_active_chip() {
    return this._chips.selected_item as QueueChip;
  }
}

interface AddSong2Options {
  shuffle?: boolean;
  next?: boolean;
  signal?: AbortSignal;
  play?: boolean;
  radio?: boolean;
}

interface AddPlaylist2Options {
  shuffle?: boolean;
  next?: boolean;
  signal?: AbortSignal;
  play?: boolean;
  radio?: boolean;
}

function is_track_video(track: QueueTrack) {
  return track.videoType !== "MUSIC_VIDEO_TYPE_ATV";
}

interface AddTracksOptions {
  clear?: boolean;
  remove_rest?: boolean;
}
