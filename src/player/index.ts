import Gst from "gi://Gst";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";

import { add_history_item, get_option, get_song } from "libmuse";
import type { AudioFormat, Format, Song, VideoFormat } from "libmuse";
import { throttle } from "lodash-es";

import { Application } from "../application.js";
import { Settings } from "../util/settings";
import { ObjectContainer } from "../util/objectcontainer.js";
import { AddActionEntries } from "src/util/action.js";
import { GioFileStore } from "src/util/giofilestore.js";
import { list_model_to_array } from "src/util/list.js";
import { get_track_settings, get_tracklist } from "./helpers.js";
import { convert_formats_to_dash } from "./mpd";

import {
  Queue,
  QueueMeta,
  QueueSettings,
  RepeatMode,
  tracks_to_meta,
} from "./queue";

import { MuzikaMediaStream } from "./stream.js";

if (!Gst.is_initialized()) {
  GLib.setenv("GST_PLAY_USE_PLAYBIN3", "1", false);

  Gst.init(null);
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
    // normalise duration when the media-info is not available
    if (super.duration <= 0) {
      const duration_seconds = this.now_playing?.object.song.videoDetails
        .lengthSeconds;

      if (duration_seconds) {
        // to microsecond
        return duration_seconds * 1000000;
      }

      return 0;
    }

    return super.duration;
  }

  constructor(options: { app: Application }) {
    super();

    this.app = options.app;
    this._queue = new Queue({ app: options.app });

    this._queue.connect("notify::current", () => {
      this._play.set_video_track_enabled(this.queue.current_is_video);

      const current = this.queue.current?.object;

      const now_playing_videoId = this.now_playing?.object.track.videoId;
      const counterpart_videoId = current?.counterpart?.videoId;

      // try to seek to the same position
      if (
        counterpart_videoId && counterpart_videoId === now_playing_videoId &&
        current.duration_seconds && this.timestamp !== 0
      ) {
        this.initial_seek_to = (this.timestamp / this.duration) *
          (current.duration_seconds * Gst.MSECOND);
      } else {
        // reset seek
        this.initial_seek_to = null;
      }

      this.load(current ?? null)
        .then(() => {
          this.save_state();
        })
        .catch((e) => {
          console.log("caught error", e);
        });
    });

    this.queue.connect("prepare-next", (_, next: string) => {
      const now_playing_videoId = this.now_playing?.object.track.videoId;

      // if trying to play the already-playing song, just play if paused
      if (now_playing_videoId && now_playing_videoId === next) {
        return;
      }

      this.stop();

      // this._loading_track = next;
      // this.emit("loading-track");

      // this._play.pause();
      // this._play.seek(0);

      // this._is_buffering = true;
      // this.notify("is-buffering");
    });

    this.queue.connect("play", () => {
      this.play();
    });

    // volume

    Settings.connect("changed::volume", () => {
      const settings_volume = Settings.get_double("volume");
      if (settings_volume !== this.volume) {
        this.volume = settings_volume;
      }
    });

    super.volume = Settings.get_double("volume");

    Settings.connect("changed::muted", () => {
      const settings_muted = Settings.get_boolean("muted");
      if (settings_muted !== this.muted) {
        this.muted = settings_muted;
      }
    });

    super.muted = Settings.get_boolean("muted");

    // restore state

    this.load_state();

    Settings.connect("changed::audio-quality", () => {
      console.log(
        "audio-quality changed",
        AudioQuality[Settings.get_enum("audio-quality")],
      );
      this.update_uri();
    });

    Settings.connect("changed::video-quality", () => {
      console.log(
        "video-quality changed",
        VideoQuality[Settings.get_enum("video-quality")],
      );
      this.update_uri();
    });
  }

  get volume() {
    return super.volume;
  }

  private update_volume(value: number) {
    super.volume = value;

    if (value !== Settings.get_double("volume")) {
      Settings.set_double("volume", value);
    }
  }

  private throttled_update_volume = throttle(this.update_volume, 100, {
    leading: true,
    trailing: true,
  });

  set volume(value: number) {
    // value and this.volume are of different precision
    if (compare_numbers(this.volume, value)) return;

    this.throttled_update_volume(value);
  }

  get muted() {
    return super.muted;
  }

  set muted(value: boolean) {
    if (this.muted === value) return;

    super.muted = value;

    if (value !== Settings.get_boolean("muted")) {
      Settings.set_boolean("muted", value);
    }
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
    const song = this.now_playing?.object.song;

    if (song) {
      if (this.add_history && get_option("auth").has_token()) {
        // add history entry, but don't wait for the promise to resolve
        add_history_item(song)
          .catch((err) => {
            console.log("Couldn't add history item", err);
          });

        this.add_history = false;
      }
    }
  }

  private loading_controller: AbortController | null = null;

  private _loading_track: string | null = null;

  get loading_track() {
    return this._loading_track;
  }

  private update_uri() {
    const song = this.now_playing?.object.song;

    if (!song || !this._play.get_media_info()) return;

    this.initial_seek_to = this.get_timestamp();
    this.set_uri(get_song_uri(song));

    this.resume();
  }

  async load(track: QueueMeta | null) {
    // TODO: stop
    if (!track) return;

    const current = this.now_playing?.object.track.videoId;

    // if the requested track is already playing, just resume playback
    if (current == track.videoId) {
      this.play();
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

    this.is_buffering = true;

    return Promise.all([
      get_song(track.videoId, { signal: this.loading_controller!.signal }),
      get_track_settings(track.videoId, this.loading_controller!.signal),
    ])
      .then(([song, settings]) => {
        this._now_playing = new ObjectContainer<TrackMetadata>({
          song,
          track,
          settings: {
            ...settings,
            playlistId: this.queue.settings.object?.playlistId ??
              settings.playlistId,
          },
        });
        this.notify("now-playing");
        this.notify("duration");

        const uri = get_song_uri(song);
        this.set_uri(uri);

        this.resume();

        this.add_history = true;
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name == "AbortError") return;

        console.log(error);
      });
  }

  async refresh_uri() {
    const track = this.now_playing?.object.track;

    if (!track?.videoId) {
      return;
    }

    if (this.loading_controller != null) {
      this.loading_controller.abort();
      this.loading_controller = null;
    }

    this.initial_seek_to = this.timestamp;

    this.loading_controller = new AbortController();

    return get_song(track.videoId, { signal: this.loading_controller!.signal })
      .then((song) => {
        this.refreshed_uri = true;

        this._now_playing = new ObjectContainer<TrackMetadata>({
          ...this.now_playing?.object!,
          song,
        });

        this.notify("now-playing");

        const uri = get_song_uri(song);

        this.set_uri(uri);

        this.resume();
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name == "AbortError") return;

        console.log(error);
      });
  }

  protected eos_cb(_play: GstPlay.Play) {
    if (super.eos_cb(_play)) {
      this.queue.repeat_or_next();
    }

    return true;
  }

  private serialize_state(): PlayerState | null {
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
      settings: this.queue.settings.object,
    };
  }

  private async apply_state(state?: PlayerState) {
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

  store = new GioFileStore();

  private async load_state() {
    const state = this.store.get("player-state") as PlayerState | undefined;

    await this.apply_state(state)
      .catch((err) => console.error(err));
  }

  save_state() {
    const state = this.serialize_state();

    this.store.set("player-state", state);
  }

  play_pause() {
    this.playing = !this.playing;
  }

  protected media_info_updated_cb(
    _play: GstPlay.Play,
    info: GstPlay.PlayMediaInfo,
  ): void {
    super.media_info_updated_cb(_play, info);

    // update current subtitle in UI
    if (!this._action_group) return;

    const index = this._play.get_current_subtitle_track()?.get_index() ?? -1;

    this._action_group.change_action_state(
      "subtitle-index",
      GLib.Variant.new("i", index),
    );
  }

  private _action_group: Gio.SimpleActionGroup | null = null;

  get_action_group() {
    const action_group = Gio.SimpleActionGroup.new();

    action_group.add_action(Settings.create_action("video-quality"));
    action_group.add_action(Settings.create_action("audio-quality"));

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
      {
        name: "subtitle-index",
        parameter_type: "i",
        activate: (action, param: GLib.Variant<"i"> | null) => {
          if (!param) return;

          if (param.get_type_string() != "i") return;

          action.change_state(param);
        },
        state: "-1",
        change_state: (action, value: GLib.Variant<"i"> | null) => {
          if (!value) return;

          let int = value.get_int32();
          const subtitle_streams =
            this._play.media_info.get_subtitle_streams().length;

          if (int < -1) {
            int = -1;
          } else if (int >= subtitle_streams) {
            return;
          }

          this.set_subtitle_index(value.get_int32());
          action.set_state(value);
        },
      },
      {
        name: "volume-up",
        activate: () => {
          this.cubic_volume = Math.min(1, this.cubic_volume + 0.1);
        },
      },
      {
        name: "volume-down",
        activate: () => {
          this.cubic_volume = Math.max(0, this.cubic_volume - 0.1);
        },
      },
      {
        name: "skip-backwards",
        activate: () => {
          this.seek(Math.max(this.timestamp - 10000000, 0));
        },
      },
      {
        name: "skip-forward",
        activate: () => {
          const new_timestamp = this.timestamp + 10000000;

          if (new_timestamp < this.duration) {
            this.seek(new_timestamp);
          } else {
            this.queue.next();
          }
        },
      },
    ]);

    this.connect("notify::playing", () => {
      action_group.action_enabled_changed("play", !this.playing);
      action_group.action_enabled_changed("pause", this.playing);
    });

    action_group.action_enabled_changed("play", !this.playing);
    action_group.action_enabled_changed("pause", this.playing);

    this._action_group = action_group;

    return action_group;
  }

  private set_subtitle_index(index: number) {
    if (index < 0) {
      this._play.set_subtitle_track_enabled(false);
      return;
    }

    this._play.set_subtitle_track(index);
    this._play.set_subtitle_track_enabled(true);
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
  track: QueueMeta;
  settings: QueueSettings;
};

export function format_has_audio(format: Format): format is AudioFormat {
  return format.has_audio;
}

export function format_has_video(format: Format): format is VideoFormat {
  return format.has_video;
}

function get_song_formats<
  Video extends true | false,
  Quality extends Video extends true ? VideoQuality : AudioQuality,
  FormatType extends Video extends true ? VideoFormat : AudioFormat,
>(video: Video, formats: FormatType[], quality: Quality, force_mp4?: boolean) {
  return formats
    .filter(
      // get requested formats
      video ? format_has_video : format_has_audio,
    )
    .filter((format) => {
      // only use mp4 if format is auto or we're currently playing a video
      let mime_type;

      if (video) {
        if (force_mp4 || quality === VideoQuality.auto) {
          mime_type = "video/mp4";
        } else {
          mime_type = "video/webm";
        }
      } else {
        if (force_mp4 || quality === AudioQuality.auto) {
          mime_type = "audio/mp4";
        } else {
          mime_type = "audio/webm";
        }
      }

      return format.mime_type.startsWith(mime_type);
    })
    .filter((format) => {
      // filter requested manifests
      if (video && format_has_video(format)) {
        return quality === VideoQuality.auto ||
          format.video_quality == VideoQuality[quality];
      } else if (!video && format_has_audio(format)) {
        return quality === AudioQuality.auto ||
          format.audio_quality == AudioQuality[quality];
      } else {
        return false;
      }
    })
    .sort((a, b) => {
      // sort from lowest quality to highest

      if (format_has_audio(a) && format_has_audio(b)) {
        return a.sample_rate - b.sample_rate;
      } else if (format_has_video(a) && format_has_video(b)) {
        return a.width - b.width;
      } else {
        return 0;
      }
    });
}

// try get formats of the specified quality, if it's not possible, get the closest format
function get_best_formats(
  video: boolean,
  formats: Format[],
  quality: VideoQuality | AudioQuality,
  force_mp4 = false,
) {
  const correct_formats = get_song_formats(video, formats, quality, force_mp4);

  // if the requested format is auto, no further processing
  if (video && quality === VideoQuality.auto) {
    return correct_formats;
  } else if (!video && quality === AudioQuality.auto) {
    return correct_formats;
  }

  // try to get a lower bit quality format if possible
  let best_quality = quality;
  let best_formats: Format[] = [];

  while (best_quality >= 0) {
    best_formats = get_song_formats(
      video,
      formats,
      best_quality,
    );

    if (best_formats.length > 0) {
      return best_formats;
    }

    best_quality--;
  }

  return best_formats;
}

function get_song_uri(song: Song) {
  const formats = [...song.formats, ...song.adaptive_formats];

  const is_video = song.videoDetails.musicVideoType !== "MUSIC_VIDEO_TYPE_ATV";

  // for music videos, no video formats are necessary
  const video_formats = is_video
    ? get_best_formats(true, formats, Settings.get_enum("video-quality"))
    : [];

  const audio_formats = get_best_formats(
    false,
    formats,
    // when playing a music video, get the medium audio quality
    // ive never seen a video with a high audio quality, and using multiple
    // video & audio formats causes dashdemux2 issues
    is_video ? AudioQuality.medium : Settings.get_enum("audio-quality"),
    video_formats.length > 0,
  )
    // TODO: there's a GStreamer bug that causes weird problems with audio files.
    // In this section, we only get one audio track unless audio quality
    // is specifically set to `auto`
    .slice(
      0,
      is_video || Settings.get_enum("audio-quality") != AudioQuality.auto
        ? 1
        : undefined,
    );

  const total_formats = [...video_formats, ...audio_formats];

  // if there is just one format (and no subtitles, play the format URL directly)
  if (total_formats.length === 1 && song.captions.length === 0) {
    return total_formats[0].url;
  }

  return `data:application/dash+xml;base64,${
    btoa(convert_formats_to_dash({
      ...song,
      adaptive_formats: [],
      formats: total_formats,
    }))
  }`;
}

export const VideoQualities: { name: string; value: string }[] = [
  { name: _("Auto"), value: "auto" },
  { name: "144p", value: "tiny" },
  { name: "240p", value: "small" },
  { name: "360p", value: "medium" },
  { name: "480p", value: "large" },
  { name: "720p", value: "hd720" },
  { name: "1080p (HD)", value: "hd1080" },
  { name: "1440p (HD)", value: "hd1440" },
  { name: "2160p (4K)", value: "hd2160" },
  { name: _("High Resolution"), value: "highres" },
];

export enum VideoQuality {
  auto = 0,
  tiny = 1,
  small = 2,
  medium = 3,
  large = 4,
  hd720 = 5,
  hd1080 = 6,
  hd1440 = 7,
  hd2160 = 8,
  highres = 9,
}

export const AudioQualities: { name: string; value: string }[] = [
  { name: _("Auto"), value: "auto" },
  { name: _("Very Low"), value: "tiny" },
  { name: _("Low"), value: "low" },
  { name: _("Medium"), value: "medium" },
  { name: _("High"), value: "high" },
];

export enum AudioQuality {
  auto = 0,
  tiny = 1,
  low = 2,
  medium = 3,
  high = 4,
}

// compare numbers of different precisions
function compare_numbers(a: number, b: number): boolean {
  return Math.abs(Math.fround(a) - Math.fround(b)) < 0.00001;
}
