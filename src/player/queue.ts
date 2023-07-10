import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import {
  get_queue,
  get_queue_ids,
  Queue as MuseQueue,
  QueueOptions,
} from "../muse.js";
import { ObjectContainer } from "../util/objectcontainer.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { AddActionEntries } from "src/util/action.js";
import { Application } from "src/application.js";
import { Window } from "src/window.js";
import { list_model_to_array } from "src/util/list.js";
import { ngettext } from "gettext";
import {
  get_track_queue,
  get_track_settings,
  get_tracklist,
} from "./helpers.js";

const vprintf = imports.format.vprintf;

export type QueueSettings = Omit<MuseQueue, "tracks">;

export enum RepeatMode {
  NONE = 0,
  ALL = 1,
  ONE = 2,
}

export interface QueueMeta extends QueueTrack {
  playlist: string | null;
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
        "active-chip": GObject.param_spec_string(
          "active-chip",
          "Active chip",
          "The active chip",
          null as any,
          GObject.ParamFlags.READWRITE,
        ),
      },
      Signals: {
        "prepare-next": {
          param_types: [GObject.TYPE_STRING],
        },
      },
    }, this);
  }

  private _list: Gio.ListStore<ObjectContainer<QueueMeta>> = new Gio
    .ListStore();
  // original is used to store unshuffled list
  _original: Gio.ListStore<ObjectContainer<QueueMeta>> = new Gio
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

  change_position(position: number) {
    if (position != this._position) {
      this._position = position;

      this.notify("position");
      this.notify("current");
      this.notify("can-play-next");
      this.notify("can-play-previous");
    }
  }

  private increment_position(n: number) {
    this.change_position(this.position + n);
  }

  private _settings?: QueueSettings;

  get settings() {
    return this._settings;
  }

  set_settings(settings: QueueSettings) {
    this._settings = settings;
    this.notify("settings");
  }

  private settings_abort_controller?: AbortController;

  private update_track_settings() {
    if (this.settings_abort_controller) {
      this.settings_abort_controller.abort();
      this.settings_abort_controller = undefined;
    }

    if (this.current?.object.videoId) {
      this.settings_abort_controller = new AbortController();

      get_track_settings(
        this.current?.object.videoId,
        this.settings_abort_controller.signal,
      )
        .then((settings) => {
          if (this.settings) {
            this.set_settings({
              ...this.settings,
              current: settings.current,
              lyrics: settings.lyrics,
              related: settings.related,
            });
          } else {
            this.set_settings(settings);
          }
        })
        .catch(() => {})
        .finally(() => {
          this.settings_abort_controller = undefined;
        });
    }
  }

  _shuffle = false;

  get shuffle() {
    return this._shuffle;
  }

  set shuffle(shuffled: boolean) {
    this._shuffle = shuffled;
    this.notify("shuffle");

    if (shuffled) {
      this._original.remove_all();

      const items = list_model_to_array(this._list);

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
      const items = list_model_to_array(this._original);

      this._list.splice(
        this.position + 1,
        items.length - this.position - 1,
        items.slice(this.position + 1),
      );

      this._original.remove_all();
    }
  }

  private _active_chip: string | null = null;

  get active_chip() {
    return this._active_chip;
  }

  set active_chip(chip: string | null) {
    this._active_chip = chip;
    this.notify("active-chip");
  }

  app: Application;

  constructor(options: { app: Application }) {
    super();

    this.app = options.app;
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
            radio: params.has("radio"),
          });
        },
      },
      {
        name: "add-playlist",
        parameter_type: "s",
        activate: (__, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()}`);
          const params = url.searchParams;

          this.add_playlist(url.pathname, params.get("video") ?? undefined, {
            next: params.has("next"),
            shuffle: params.has("shuffle"),
          }).then((queue) => {
            const win = this.app.active_window;

            if (win instanceof Window) {
              if (!queue.playlist) return;

              const normalized_title = GLib.markup_escape_text(
                queue.playlist,
                -1,
              );

              win.add_toast(
                params.has("next")
                  ? vprintf(_('Playing "%s" next'), [normalized_title])
                  // Translators: %s is a playlist name
                  : vprintf(_('Added "%s" to queue'), [normalized_title]),
              );
            }
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
            this.play_songs(ids, {
              shuffle: params.has("shuffle"),
            });
          }
        },
      },
      {
        name: "add-song",
        parameter_type: "s",
        activate: (__, param) => {
          if (!param) return;

          const url = new URL(`muzika:${param.get_string()[0]}`);
          const params = url.searchParams;

          this.add_songs(url.pathname.split(","), {
            next: params.has("next"),
            shuffle: params.has("shuffle"),
          }).then((tracks) => {
            const win = this.app.active_window;

            if (win instanceof Window) {
              const normalized_title = GLib.markup_escape_text(
                tracks[0].title,
                -1,
              );

              win.add_toast(
                params.has("next")
                  ? ngettext(
                    // Translators: %s is a song's name
                    vprintf(_('Playing "%s" next'), [normalized_title]),
                    vprintf(_("Playing %d songs next"), [tracks.length]),
                    tracks.length,
                  )
                  : ngettext(
                    // Translators: %s is a song's name
                    vprintf(_('Added "%s" to queue'), [normalized_title]),
                    vprintf(_("Added %d songs to queue"), [tracks.length]),
                    tracks.length,
                  ),
              );
            }
          });
        },
      },
      {
        name: "previous",
        activate: () => {
          this.previous();
        },
      },
      {
        name: "next",
        activate: () => {
          this.next();
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

  // TODO:
  // this.track_options_settings.set(video_id, _omit(queue, ["tracks"]));
  /**
   * This functions gets and caches the track
   */

  async change_active_chip(chip: string | null) {
    const found_chip = this.settings?.chips.find((c) => c.playlistId == chip);

    if (chip && found_chip) {
      const local_settings = this.settings;

      await get_queue(null, found_chip.playlistId, {
        params: found_chip.params,
      }).then((queue) => {
        // don't do anything if the queue has changed
        if (local_settings != this.settings) {
          this.active_chip = null;
        }

        this.list.splice(
          this.position + 1,
          this.list.n_items - this.position - 1,
          tracks_to_meta(queue.tracks, found_chip.playlistId)
            .map((track) => new ObjectContainer(track)),
        );

        this.active_chip = chip;

        this.notify("can-play-previous");
        this.notify("can-play-next");
      });
    }

    this.active_chip = chip;
  }

  async add_playlist(
    playlist_id: string,
    video_id?: string,
    options: AddPlaylistOptions = {},
  ) {
    if (options.play) {
      this.emit("prepare-next", video_id ?? "");
    }

    const queue = await get_queue(video_id ?? null, playlist_id, {
      shuffle: options.shuffle ?? false,
      signal: options.signal,
      radio: options.radio ?? false,
    });

    if (options.play) {
      this.clear();
    }

    if (options.next) {
      this.play_next(
        tracks_to_meta(queue.tracks, playlist_id),
        queue.current?.index,
      );
    } else {
      this.add(tracks_to_meta(queue.tracks, playlist_id), queue.current?.index);
    }

    if (options.play) {
      this.set_settings(_omit(queue, ["tracks"]));

      const position = queue.current?.index
        ? queue.current?.index % queue.tracks.length
        : 0;

      this.change_position(position);
    }

    return queue;
  }

  async add_songs(song_ids: string[], options: AddSongOptions = {}) {
    if (options.play) {
      this.emit("prepare-next", song_ids[0]);
    }

    let tracks: QueueTrack[], first_track_options: QueueSettings | undefined;

    if (song_ids.length === 1 && options.radio) {
      // fast path to get the track options and tracklist at the same time
      const queue = await get_track_queue(song_ids[0], { radio: true });

      tracks = queue.tracks;
      first_track_options = _omit(queue, ["tracks"]);
    } else {
      [tracks, first_track_options] = await Promise.all([
        get_tracklist(song_ids).then((tracks) => tracks ?? []),
        options.play ? get_track_settings(song_ids[0]) : undefined,
      ]);
    }

    if (options.play) {
      this.clear();
    }

    if (options.next) {
      this.play_next(tracks_to_meta(tracks));
    } else {
      this.add(tracks_to_meta(tracks));
    }

    if (first_track_options) {
      this.set_settings(first_track_options);
    }

    if (options.play) {
      this.change_position(0);
    }

    return tracks;
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
    await this.play_songs([song_id], { signal, radio: true });
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
        position = -1;
      } else {
        position = this.position + 1;
      }
    }

    return [position, this.list.get_item(position)?.object ?? null];
  }

  next(): QueueTrack | null {
    const [position, track] = this.peek_next();

    this.update_position(position);

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

    this.update_position(position);

    return track;
  }

  private update_position(position: number) {
    if (position === -1) return null;

    this.change_position(position);

    this.update_track_settings();
  }

  previous(): QueueTrack | null {
    if (this.repeat === RepeatMode.ALL) {
      if (this.position <= 0) {
        this.change_position(this.list.n_items - 1);
      } else {
        this.increment_position(-1);
      }

      this.update_track_settings();

      return this.list.get_item(this.position)?.object!;
    } else {
      if (this.position <= 0) return null;

      this.increment_position(-1);

      this.update_track_settings();

      return this.list.get_item(this.position)?.object!;
    }
  }

  private add_to_queue_at_position(
    tracks: QueueMeta[],
    position: number,
    new_position?: number,
  ) {
    this.list.splice(
      position,
      0,
      tracks.map((song) => new ObjectContainer(song)),
    );

    if (this.shuffle) {
      this._original.splice(
        position,
        0,
        tracks.map((song) => new ObjectContainer(song)),
      );
    }

    if (new_position != null) {
      this.change_position(new_position);
      this.update_track_settings();
    } else if (this.position < 0) {
      this.change_position(0);
      this.update_track_settings();
    } else {
      this.notify("can-play-previous");
      this.notify("can-play-next");
    }
  }

  private play_next(
    tracks: QueueMeta[],
    new_position?: number,
  ) {
    this.add_to_queue_at_position(
      tracks,
      this.position + 1,
      new_position,
    );
  }

  add(tracks: QueueMeta[], new_position?: number) {
    this.add_to_queue_at_position(
      tracks,
      this.list.n_items,
      new_position,
    );
  }
}

interface AddSongOptions {
  shuffle?: boolean;
  next?: boolean;
  signal?: AbortSignal;
  play?: boolean;
  radio?: boolean;
}

interface AddPlaylistOptions {
  shuffle?: boolean;
  next?: boolean;
  signal?: AbortSignal;
  play?: boolean;
  radio?: boolean;
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

export function tracks_to_meta(
  tracks: QueueTrack[],
  playlist: string | null = null,
): QueueMeta[] {
  return tracks.map((track) => ({ ...track, playlist }));
}
