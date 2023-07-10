import Gst from "gi://Gst";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";
import Gtk from "gi://Gtk?version=4.0";

import {
  Queue,
  QueueMeta,
  QueueSettings,
  RepeatMode,
  tracks_to_meta,
} from "./queue";
import { AudioFormat, Format, get_song, Song } from "src/muse";
import { Application, Settings } from "../application.js";
import { ObjectContainer } from "../util/objectcontainer.js";
import { AddActionEntries } from "src/util/action.js";
import { store } from "src/util/giofilestore.js";
import { list_model_to_array } from "src/util/list.js";
import { get_track_settings, get_tracklist } from "./helpers.js";

const preferred_quality: AudioFormat["audio_quality"] = "medium";
const preferred_format: AudioFormat["audio_codec"] = "opus";

type MaybeAdaptiveFormat = AudioFormat & {
  adaptive: boolean;
};

if (!Gst.is_initialized()) {
  GLib.setenv("GST_PLAY_USE_PLAYBIN3", "1", false);

  Gst.init(null);
}

type GTypeToType<Y extends GObject.GType> = Y extends GObject.GType<infer T> ? T
  : never;

type GTypeArrayToTypeArray<Y extends readonly GObject.GType[]> = {
  [K in keyof Y]: GTypeToType<Y[K]>;
};

class MuzikaPlaySignalAdapter extends GObject.Object {
  private static events = {
    "buffering": [GObject.TYPE_INT],
    "duration-changed": [GObject.TYPE_INT],
    "end-of-stream": [],
    "error": [GLib.Error.$gtype, Gst.Structure.$gtype],
    "media-info-updated": [GstPlay.PlayMediaInfo.$gtype],
    "mute-changed": [GObject.TYPE_BOOLEAN],
    "position-updated": [GObject.TYPE_DOUBLE],
    "seek-done": [GObject.TYPE_DOUBLE],
    "state-changed": [GstPlay.PlayState.$gtype],
    "uri-loaded": [GObject.TYPE_STRING],
    "video-dimensions-changed": [GObject.TYPE_INT, GObject.TYPE_INT],
    "volume-changed": [GObject.TYPE_INT],
    "warning": [GLib.Error.$gtype, Gst.Structure.$gtype],
  } as const;

  static {
    GObject.registerClass({
      GTypeName: "MuzikaPlaySignalAdapter",
      Signals: Object.fromEntries(
        Object.entries(this.events)
          .map(([name, types]) => [
            name,
            {
              param_types: types,
            },
          ]),
      ),
    }, this);
  }
  private _play: GstPlay.Play;

  get play(): GstPlay.Play {
    return this._play;
  }

  constructor(play: GstPlay.Play) {
    super();

    this._play = play;

    const bus = this._play.get_message_bus()!;
    bus.add_signal_watch();

    bus.connect("message", this.on_message.bind(this));
  }

  private on_message(_: GstPlay.Play, message: Gst.Message) {
    if (!GstPlay.Play.is_play_message(message)) {
      return;
    }

    const structure = message.get_structure()!;
    const type = structure.get_enum(
      "play-message-type",
      GstPlay.PlayMessage.$gtype,
    );

    if (!type[0] || structure.get_name()! !== "gst-play-message-data") {
      return;
    }

    switch (type[1] as GstPlay.PlayMessage) {
      case GstPlay.PlayMessage.URI_LOADED:
        this.emit_message("uri-loaded", [structure.get_string("uri")!]);
        break;
      case GstPlay.PlayMessage.POSITION_UPDATED:
        this.emit_message("position-updated", [
          GstPlay.play_message_parse_position_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.DURATION_CHANGED:
        this.emit_message("duration-changed", [
          GstPlay.play_message_parse_duration_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.STATE_CHANGED:
        this.emit_message("state-changed", [
          GstPlay.play_message_parse_state_changed(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.BUFFERING:
        this.emit_message("buffering", [
          GstPlay.play_message_parse_buffering_percent(message),
        ]);
        break;
      case GstPlay.PlayMessage.END_OF_STREAM:
        this.emit_message("end-of-stream", []);
        break;
      case GstPlay.PlayMessage.ERROR:
        const error = GstPlay.play_message_parse_error(message);

        this.emit_message("error", [error[0]!, error[1]!]);
        break;
      case GstPlay.PlayMessage.WARNING:
        const warning = GstPlay.play_message_parse_warning(message);

        this.emit_message("warning", [warning[0]!, warning[1]!]);
        break;
      case GstPlay.PlayMessage.VIDEO_DIMENSIONS_CHANGED:
        this.emit_message(
          "video-dimensions-changed",
          GstPlay.play_message_parse_video_dimensions_changed(message),
        );
        break;
      case GstPlay.PlayMessage.MEDIA_INFO_UPDATED:
        this.emit_message("media-info-updated", [
          GstPlay.play_message_parse_media_info_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.VOLUME_CHANGED:
        this.emit_message("volume-changed", [
          GstPlay.play_message_parse_volume_changed(message),
        ]);
        break;
      case GstPlay.PlayMessage.MUTE_CHANGED:
        this.emit_message("mute-changed", [
          GstPlay.play_message_parse_muted_changed(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.SEEK_DONE:
        this.emit_message("seek-done", [
          GstPlay.play_message_parse_position_updated(message)!,
        ]);
        break;
    }
  }

  private emit_message<
    Name extends keyof typeof MuzikaPlaySignalAdapter["events"],
    Types extends typeof MuzikaPlaySignalAdapter["events"][Name],
  >(
    name: Name,
    args: GTypeArrayToTypeArray<Types>,
  ) {
    this.emit(name as string, ...args as GTypeToType<Types[number]>[]);
  }
}

export class MuzikaMediaStream extends Gtk.MediaStream {
  static {
    GObject.registerClass({
      GTypeName: "MuzikaMediaStream",
      Properties: {
        queue: GObject.param_spec_object(
          "queue",
          "Queue",
          "The queue",
          Queue.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        buffering: GObject.param_spec_boolean(
          "is-buffering",
          "Is Buffering",
          "Whether the player is buffering",
          false,
          GObject.ParamFlags.READABLE,
        ),
      },
    }, this);
  }

  constructor() {
    super();

    this._play = new GstPlay.Play();

    const bus = this._play.get_message_bus();
    bus.add_signal_watch();

    const adapter = new MuzikaPlaySignalAdapter(this._play);

    adapter.connect("buffering", this.buffering_cb.bind(this));
    adapter.connect("end-of-stream", this.eos_cb.bind(this));
    adapter.connect("error", this.error_cb.bind(this));
    adapter.connect("state-changed", this.state_changed_cb.bind(this));
    adapter.connect("uri-loaded", this.uri_loaded_cb.bind(this));
    adapter.connect("position-updated", this.position_updated_cb.bind(this));
    adapter.connect("duration-changed", this.duration_changed_cb.bind(this));
    adapter.connect(
      "media-info-updated",
      this.media_info_updated_cb.bind(this),
    );
    adapter.connect("volume-changed", this.volume_changed_cb.bind(this));
    adapter.connect("mute-changed", this.mute_changed_cb.bind(this));
    adapter.connect("seek-done", this.seek_done_cb.bind(this));

    const sink = Gst.ElementFactory.make("fakesink", "sink")!;

    if (!sink) {
      throw new Error("Failed to create sink");
    }

    this._play.pipeline.set_property("video-sink", sink);
  }

  // UTILS

  protected _play: GstPlay.Play;

  protected initial_seek_to: number | null = null;

  private do_initial_seek() {
    if (this.initial_seek_to !== null) {
      this.seek(this.initial_seek_to);
      this.initial_seek_to = null;
    }
  }

  // PROPERTIES

  private _state = GstPlay.PlayState.STOPPED;

  get state() {
    return this._state;
  }

  // property: buffering

  protected _is_buffering = false;

  get is_buffering() {
    return this._is_buffering;
  }

  // property: duration

  get duration() {
    if (!this._play.media_info) return 0;

    return this._play.media_info.get_duration() / Gst.USECOND;
  }

  // property: ended

  protected _ended = false;

  get ended() {
    return this._ended;
  }

  // property: error

  private _error: GLib.Error | null = null;

  get error() {
    return this._error as GLib.Error;
  }

  // property: has-audio

  get has_audio() {
    if (!this._play.media_info) return false;

    return this._play.media_info.get_number_of_audio_streams() > 0;
  }

  // property: has-video

  get has_video() {
    if (!this._play.media_info) return false;

    return this._play.media_info.get_number_of_video_streams() > 0;
  }

  // property: loop

  // TODO: add loop-mode

  private _loop = false;

  public get loop() {
    return this._loop;
  }
  public set loop(value) {
    this._loop = value;
  }

  // property: muted

  get muted() {
    return this._play.mute;
  }

  // property: playing

  protected _playing = false;

  public get playing() {
    return this._playing;
  }

  public set playing(value) {
    if (value) {
      this._play.play();
    } else {
      this._play.pause();
    }

    this._playing = value;
    this.notify("playing");
  }

  play() {
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  // property: playing

  // get prepared() {
  //   const state = this.get_state();

  //   if (!state) return false;

  //   return state >= Gst.State.READY;
  // }

  // property: seekable

  // property: volume

  get volume() {
    return this._play.volume;
  }

  set volume(value) {
    this._play.volume = value;
  }

  // FUNCTIONS

  // error functions

  gerror(error: GLib.Error): void {
    this._error = error;
    this.notify("error");

    console.error("error during playback", error.message, error.toString());

    // TODO: cancel pending seeks
    this._play.stop();

    if (this.prepared) {
      this.stream_unprepared();
    }

    this.playing = false;
  }

  // seek

  vfunc_seek(timestamp: number): void {
    this.update(timestamp);
    this._play.seek(Math.trunc(timestamp * Gst.USECOND));
  }

  // handlers

  private buffering_cb(_play: GstPlay.Play, percent: number): void {
    if (percent < 100) {
      if (!this.is_buffering && this.playing) {
        this.pause();

        this._is_buffering = true;
        this.notify("is-buffering");
      }
    } else {
      this._is_buffering = false;
      this.notify("is-buffering");

      if (this.playing) this.play();
    }
  }

  private uri_loaded_cb(_play: GstPlay.Play): void {
    if (this.prepared) {
      this.stream_unprepared();
    }

    this._ended = false;
    this.notify("ended");

    if (this.playing) {
      this._play.play();
    } else {
      this._play.pause();
    }
  }

  private position_updated_cb(_play: GstPlay.Play, position: number): void {
    this.update(position / Gst.USECOND);
  }

  private duration_changed_cb(_play: GstPlay.Play): void {
    this.notify("duration");
  }

  private state_changed_cb(
    _play: GstPlay.Play,
    state: GstPlay.PlayState,
  ): void {
    this._state = state;

    if (state == GstPlay.PlayState.BUFFERING) {
      this._is_buffering = true;
      this.notify("is-buffering");
    } else if (this.is_buffering && state != GstPlay.PlayState.STOPPED) {
      this._is_buffering = false;
      this.notify("is-buffering");
    }

    if (state == GstPlay.PlayState.STOPPED) {
      this.update(0);

      if (this.prepared) {
        this.stream_unprepared();
      }
    } else {
      if (!this.is_prepared) {
        this.stream_prepared(
          this.has_audio,
          this.has_video,
          this.seekable,
          this.duration,
        );

        this.do_initial_seek();

        this._ended = false;
        this.notify("ended");
      }
    }
  }

  private error_cb(_play: GstPlay.Play, error: GLib.Error): void {
    this.gerror(error);
  }

  protected eos_cb(_play: GstPlay.Play): void {
    this.stream_ended();

    this._ended = true;
    this.notify("ended");
  }

  private media_info_updated_cb(
    _play: GstPlay.Play,
    info: GstPlay.PlayMediaInfo,
  ): void {
    if (!this.prepared) {
      this.stream_prepared(
        info.get_number_of_audio_streams() > 0,
        info.get_number_of_video_streams() > 0,
        info.is_seekable(),
        this._play.get_duration(),
      );

      this.do_initial_seek();
    }
  }

  private volume_changed_cb(_play: GstPlay.Play): void {
    this.notify("volume");
  }

  private mute_changed_cb(_play: GstPlay.Play): void {
    this.notify("muted");
  }

  private seek_done_cb(_play: GstPlay.Play, timestamp: number): void {
    this.seek_success();

    this.update(timestamp / Gst.USECOND);
  }

  protected set_uri(uri: string): void {
    this._play.uri = uri;
  }

  stop() {
    this._play.stop();

    this.notify("timestamp");
  }
}

export class MuzikaPlayer extends MuzikaMediaStream {
  static {
    GObject.registerClass({
      GTypeName: "MuzikaPlayer",
      Properties: {
        queue: GObject.param_spec_object(
          "queue",
          "Queue",
          "The queue",
          Queue.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        buffering: GObject.param_spec_boolean(
          "buffering",
          "Buffering",
          "Whether the player is buffering",
          false,
          GObject.ParamFlags.READABLE,
        ),
        now_playing: GObject.param_spec_object(
          "now-playing",
          "Now playing",
          "The metadata of the currently playing song",
          ObjectContainer.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        loading_track: GObject.param_spec_string(
          "loading-track",
          "Loading track",
          "The videoId of track that is currently being loaded",
          null,
          GObject.ParamFlags.READABLE,
        ),
      },
    }, this);
  }

  private app: Application;
  private _queue: Queue;

  get queue() {
    return this._queue;
  }

  get duration() {
    const super_duration = super.duration;

    let duration;

    if (super_duration <= 0) {
      const duration_seconds =
        this.now_playing?.object.song.videoDetails.lengthSeconds;

      if (duration_seconds) {
        // to microsecond
        duration = duration_seconds * 1000000;
      } else {
        duration = 0;
      }
    } else {
      duration = super_duration;
    }

    return duration;
  }

  constructor(options: { app: Application }) {
    super();

    this.app = options.app;
    this._queue = new Queue({ app: options.app });

    this._queue.connect("notify::current", () => {
      this.load(this.queue.current?.object ?? null)
        .catch((e) => {
          console.log("caught error", e);
        });
    });

    this.queue.connect("prepare-next", (_, next: string) => {
      this.stop();

      this._playing = true;

      // this._loading_track = next;
      // this.emit("loading-track");

      // this._play.pause();
      // this._play.seek(0);

      // this._is_buffering = true;
      // this.notify("is-buffering");
    });

    // volume

    Settings.connect("changed::volume", () => {
      const settings_volume = Settings.get_double("volume");
      if (settings_volume !== this.volume) {
        this.volume = settings_volume;
      }
    });

    this.volume = Settings.get_double("volume");

    this.connect("notify::volume", () => {
      const settings_volume = Settings.get_double("volume");
      if (settings_volume !== this.volume) {
        Settings.set_double("volume", this.volume);
      }
    });

    // restore state

    this.load_state();
  }

  // property: current-meta

  private _now_playing: ObjectContainer<TrackMetadata> | null = null;

  get now_playing() {
    return this._now_playing;
  }

  // whether the next play action should add to the history
  private add_history = false;

  play() {
    super.play();

    // TODO: add history
    // const id = this.now_playing?.object.track.videoId;

    // if (id) {
    //   if (this.add_history && get_option("auth").has_token()) {
    //     // add history entry, but don't wait for the promise to resolve
    //     add_history_item(id);

    //     this.add_history = false;
    //   }
    // }
  }

  private loading_controller: AbortController | null = null;

  private _loading_track: string | null = null;

  get loading_track() {
    return this._loading_track ?? null;
  }

  async load(track: QueueMeta | null) {
    // TODO: stop
    if (!track) return;

    const current = this.now_playing?.object.track.videoId;

    // if the current track is already playing, just seek to it's start
    if (current == track.videoId) {
      this.seek(0);
      return;
    }

    if (this._loading_track == track.videoId) {
      return;
    }

    if (this.loading_controller != null) {
      this.loading_controller.abort();
      this.loading_controller = null;
    }

    this._loading_track = track.videoId;
    this.notify("loading-track");

    this.loading_controller = new AbortController();

    this.stop();

    this._is_buffering = true;
    this.notify("is-buffering");

    return Promise.all([
      get_song(track.videoId, { signal: this.loading_controller!.signal }),
      get_track_settings(track.videoId, this.loading_controller!.signal),
    ])
      .then(([song, settings]) => {
        const format = negotiate_best_format(song);

        this._now_playing = new ObjectContainer<TrackMetadata>({
          song,
          track,
          format,
          settings: {
            ...settings,
            playlistId: this.queue.settings?.playlistId ?? settings.playlistId,
          },
        });
        this.notify("now-playing");

        this._play.set_uri(format.url);

        this._is_buffering = true;
        this.notify("is-buffering");

        this.add_history = true;
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name == "AbortError") return;

        console.log(error);
      });
  }

  protected eos_cb(_play: GstPlay.Play): void {
    this.stream_ended();

    this._ended = true;
    this.notify("ended");

    this.queue.repeat_or_next();
  }

  private get_state(): PlayerState | null {
    if (!this.queue.current?.object) {
      return null;
    }

    const get_tracks = (list: Gio.ListStore<ObjectContainer<QueueMeta>>) => {
      return list_model_to_array(list)
        .map((container) => container.object)
        .filter(Boolean)
        .map((track) => track?.videoId) as string[];
    };

    return {
      shuffle: this.queue.shuffle,
      repeat: this.queue.repeat,
      position: this.queue.position,
      tracks: get_tracks(this.queue.list),
      original: get_tracks(this.queue._original),
      seek: this.timestamp,
      settings: this.queue.settings,
    };
  }

  private async set_state(state?: PlayerState) {
    if (!state) return;

    if (state.tracks.length === 0) return;

    if (state.settings) {
      this.queue.set_settings(state.settings);
    }

    if (state.seek) {
      this.initial_seek_to = state.seek;
    }

    await Promise.all([
      get_tracklist(state.tracks)
        .then((tracks) => {
          this.queue.add(tracks_to_meta(tracks), state.position ?? undefined);
        }),
      get_tracklist(state.original)
        .then((tracks) =>
          tracks.forEach((track) =>
            this.queue._original.append(
              new ObjectContainer({ ...track, playlist: null }),
            )
          )
        ),
    ]);

    this.queue._shuffle = state.shuffle;
    this.queue.repeat = state.repeat;
  }

  private async load_state() {
    const state = store.get("player-state") as PlayerState | undefined;

    await this.set_state(state)
      .catch((err) => console.error(err));
  }

  save_state() {
    const state = this.get_state();

    store.set("player-state", state);
  }

  play_pause() {
    this.playing = !this.playing;
  }

  get_action_group() {
    const action_group = Gio.SimpleActionGroup.new();

    (action_group.add_action_entries as AddActionEntries)([
      {
        name: "play",
        activate: () => {
          this.play();
        },
      },
      {
        name: "pause",
        activate: () => {
          this.pause();
        },
      },
      {
        name: "play-pause",
        activate: () => {
          this.play_pause();
        },
      },
      {
        name: "seek",
        parameter_type: "d",
        activate: (_action, param: GLib.Variant<"d"> | null) => {
          if (!param) return;
          this.seek(param.get_double());
        },
      },
    ]);

    this.connect("notify::playing", () => {
      action_group.action_enabled_changed("play", !this.playing);
      action_group.action_enabled_changed("pause", this.playing);
    });

    action_group.action_enabled_changed("play", !this.playing);
    action_group.action_enabled_changed("pause", this.playing);

    this.queue.connect("notify::can-play-previous", () => {
      action_group.action_enabled_changed(
        "previous",
        this.queue.can_play_previous,
      );
    });

    action_group.action_enabled_changed(
      "previous",
      this.queue.can_play_previous,
    );

    this.queue.connect("notify::can-play-next", () => {
      action_group.action_enabled_changed("next", this.queue.can_play_next);
    });

    action_group.action_enabled_changed("next", this.queue.can_play_next);

    return action_group;
  }
}

export interface PlayerState {
  shuffle: boolean;
  repeat: RepeatMode;
  position: number;
  tracks: string[];
  original: string[];
  seek: number;
  settings?: QueueSettings;
}

export type TrackMetadata = {
  song: Song;
  format: Format;
  track: QueueMeta;
  settings: QueueSettings;
};

function get_audio_formats(song: Song) {
  const formats = [
    ...song.formats.map((format) => {
      return {
        ...format,
        adaptive: false,
      };
    }),
    ...song.adaptive_formats.map((format) => {
      return {
        ...format,
        adaptive: true,
      };
    }),
  ];

  return formats
    .filter((format) => {
      return format.has_audio;
    }) as MaybeAdaptiveFormat[];
}

function get_format_points(format: MaybeAdaptiveFormat) {
  let points = 0;

  if (format.audio_quality === preferred_quality) {
    points += 5;
  }

  if (format.audio_codec === preferred_format) {
    points += 1;
  }

  if (format.adaptive) {
    points += 1;
  }

  switch (format.audio_quality) {
    case "tiny":
      points += 1;
      break;
    case "low":
      points += 2;
      break;
    case "medium":
      points += 3;
      break;
    case "high":
      points += 4;
      break;
  }

  return points;
}

function negotiate_best_format(song: Song) {
  const formats = get_audio_formats(song);

  return formats.sort((a, b) => {
    return get_format_points(b) - get_format_points(a);
  })[0];
}
