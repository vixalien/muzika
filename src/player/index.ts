import Gst from "gi://Gst";
import GObject from "gi://GObject";

import { Queue, TrackOptions } from "./queue.js";
import { AudioFormat, get_song, Song } from "../muse.js";
import { QueueTrack } from "libmuse/types/parsers/queue.js";
import { ObjectContainer } from "src/util/objectcontainer.js";

const preferred_quality: AudioFormat["audio_quality"] = "medium";
const preferred_format: AudioFormat["audio_codec"] = "opus";

type MaybeAdaptiveFormat = AudioFormat & {
  adaptive: boolean;
};

export type TrackMetadata = {
  song: Song;
  format: MaybeAdaptiveFormat;
  track: QueueTrack;
  options: TrackOptions;
};

export class Player extends GObject.Object {
  static {
    GObject.registerClass({
      GTypeName: "Player",
      Properties: {
        queue: GObject.param_spec_object(
          "queue",
          "Queue",
          "The queue",
          Queue.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        current: GObject.param_spec_object(
          "current",
          "Current",
          "The current song",
          ObjectContainer.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        is_live: GObject.param_spec_boolean(
          "is-live",
          "Is live",
          "Whether the current song is live",
          false,
          GObject.ParamFlags.READABLE,
        ),
        buffering: GObject.param_spec_boolean(
          "buffering",
          "Buffering",
          "Whether the player is buffering",
          false,
          GObject.ParamFlags.READABLE,
        ),
        playing: GObject.param_spec_boolean(
          "playing",
          "Playing",
          "Whether the player is playing",
          false,
          GObject.ParamFlags.READABLE,
        ),
        seeking_enabled: GObject.param_spec_boolean(
          "seeking-enabled",
          "Seeking enabled",
          "Whether seeking is enabled",
          false,
          GObject.ParamFlags.READABLE,
        ),
        seeking_low: GObject.param_spec_uint64(
          "seeking-low",
          "Seeking low",
          "The low bound of the seeking range",
          0,
          Number.MAX_SAFE_INTEGER,
          0,
          GObject.ParamFlags.READABLE,
        ),
        seeking_high: GObject.param_spec_uint64(
          "seeking-high",
          "Seeking high",
          "The high bound of the seeking range",
          0,
          Number.MAX_SAFE_INTEGER,
          0,
          GObject.ParamFlags.READABLE,
        ),
        position: GObject.param_spec_uint64(
          "position",
          "Position",
          "The current position",
          0,
          Number.MAX_SAFE_INTEGER,
          0,
          GObject.ParamFlags.READABLE,
        ),
      },
    }, this);
  }

  playbin: Gst.Element;
  fakesink: Gst.Element;

  private _is_live = false;

  get is_live() {
    return this._is_live;
  }

  private set is_live(value: boolean) {
    this._is_live = value;
    this.notify("is-live");
  }

  private _buffering = false;

  get buffering() {
    return this._buffering;
  }

  private set buffering(value: boolean) {
    this._buffering = value;
    this.notify("buffering");
  }

  private _playing = false;

  get playing() {
    return this._playing;
  }

  private set playing(value: boolean) {
    this._playing = value;
    this.notify("playing");
  }

  private _queue: Queue = new Queue();

  get queue(): Queue {
    return this._queue;
  }

  private _current: ObjectContainer<TrackMetadata> | null = null;

  get current() {
    return this._current;
  }

  private _position = 0;

  get position() {
    return this._position;
  }

  private set position(value: number) {
    this._position = value;
    this.notify("position");
  }

  get_position() {
    const [ret, pos] = this.playbin.query_position(Gst.Format.TIME);

    if (ret) {
      return pos;
    } else {
      return null;
    }
  }

  private _seeking_enabled = false;

  get seeking_enabled() {
    return this._seeking_enabled;
  }

  private set seeking_enabled(value: boolean) {
    this._seeking_enabled = value;
    this.notify("seeking-enabled");
  }

  private _seeking_low = 0;

  get seeking_low() {
    return this._seeking_low;
  }

  private set seeking_low(value: number) {
    this._seeking_low = value;
    this.notify("seeking-low");
  }

  private _seeking_high = 0;

  get seeking_high() {
    return this._seeking_high;
  }

  private set seeking_high(value: number) {
    this._seeking_high = value;
    this.notify("seeking-high");
  }

  constructor() {
    super();

    if (!Gst.is_initialized()) {
      Gst.init(null);
    }

    this.playbin = Gst.ElementFactory.make("playbin", "player")!;
    this.fakesink = Gst.ElementFactory.make("fakesink", "fakesink")!;

    this.playbin.set_property("video-sink", this.fakesink);

    const bus = this.playbin.get_bus()!;
    bus.add_signal_watch();
    bus.connect("message", this.on_message.bind(this));
  }

  play() {
    this.playing = true;
    const ret = this.playbin.set_state(Gst.State.PLAYING);

    if (ret === Gst.StateChangeReturn.FAILURE) {
      throw new Error("Failed to play");
    } else if (ret === Gst.StateChangeReturn.NO_PREROLL) {
      this.is_live = true;
    }
  }

  pause() {
    this.playing = false;
    this.playbin.set_state(Gst.State.PAUSED);
  }

  play_pause() {
    const state = this.playbin.get_state(Number.MAX_SAFE_INTEGER)[1];

    if (state === Gst.State.PLAYING) {
      this.pause();
    } else {
      this.play();
    }
  }

  async previous() {
    const song = this.queue.previous();

    if (song) {
      this.play_song(song);
    } else {
      this.stop();
    }
  }

  async next() {
    const song = this.queue.next();

    if (song) {
      this.play_song(song);
    } else {
      this.stop();
    }
  }

  stop() {
    this.playing = false;
    this.playbin.set_state(Gst.State.NULL);
  }

  async play_song(track: QueueTrack) {
    const song = await get_song(track.videoId);
    const format = this.negotiate_best_format(song);

    this._current = ObjectContainer.new({
      song,
      track,
      format,
      options: await this.queue.get_track_options(track.videoId),
    });
    this.notify("current");

    this.stop();
    this.playbin.set_property("uri", format.url);
    this.play();
  }

  private on_message(_bus: Gst.Bus, message: Gst.Message) {
    const type = message.type;

    const [position_available, position] = this.playbin.query_position(
      Gst.Format.TIME,
    );

    if (position_available) {
      this.position = position;
    }

    switch (type) {
      case Gst.MessageType.RESET_TIME:
        const time = message.parse_reset_time();
        if (time) this.playbin.set_property("running-time", time);
        break;
      case Gst.MessageType.EOS:
        this.next();
        break;
      case Gst.MessageType.ERROR:
        this.stop();
        const [error, debug] = message.parse_error();
        console.log("Error: ", error, debug);
      case Gst.MessageType.CLOCK_LOST:
        this.playbin.set_state(Gst.State.PAUSED);
        this.playbin.set_state(Gst.State.PLAYING);
        break;
      case Gst.MessageType.BUFFERING:
        const percent = message.parse_buffering();

        if (this._is_live) return;

        if (percent === 100) {
          this.buffering = false;

          if (this.playing) this.playbin.set_state(Gst.State.PLAYING);
        } else {
          if (!this.buffering && this.playing) {
            this.playbin.set_state(Gst.State.PAUSED);
          }

          this.buffering = true;
        }
        break;
      case Gst.MessageType.STATE_CHANGED:
        const [_old_state, new_state, _pending_state] = message
          .parse_state_changed();

        const playing = new_state === Gst.State.PLAYING;

        if (playing) {
          const query = Gst.Query.new_seeking(Gst.Format.TIME);

          if (this.playbin.query(query)) {
            const result = query.parse_seeking();

            this.seeking_enabled = result[1];
            this.seeking_low = result[2];
            this.seeking_high = result[3];
          }
        }
    }
  }

  private get_format_points(format: MaybeAdaptiveFormat) {
    let points = 0;

    if (format.audio_quality === preferred_quality) {
      points += 5;
    }

    if (format.audio_codec === preferred_format) {
      points += 5;
    }

    if (format.adaptive) {
      points += 5;
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

  private negotiate_best_format(song: Song) {
    const formats = this.get_audio_formats(song);

    return formats.sort((a, b) => {
      return this.get_format_points(b) - this.get_format_points(a);
    })[0];
  }

  private get_audio_formats(song: Song) {
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
}
