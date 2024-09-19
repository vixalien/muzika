import Gst from "gi://Gst";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";

import {
  add_history_item,
  get_option,
  get_queue,
  get_queue_tracks,
  get_song,
} from "libmuse";
import type {
  AudioFormat,
  Format,
  Queue as MuseQueue,
  QueueTrack,
  Song,
  VideoFormat,
} from "libmuse";

import { Application } from "../application.js";
import { PlayerStateSettings, Settings } from "../util/settings";
import { ObjectContainer } from "../util/objectcontainer.js";
import { AddActionEntries } from "src/util/action.js";
import { list_model_to_array } from "src/util/list.js";
import { convert_formats_to_dash } from "./mpd";

import { Queue, RepeatMode } from "./queue";

import { MuzikaMediaStream } from "./stream.js";

if (!Gst.is_initialized()) {
  GLib.setenv("GST_PLAY_USE_PLAYBIN3", "1", false);

  Gst.init(null);
}

export class MuzikaPlayer extends MuzikaMediaStream {
  static {
    GObject.registerClass(
      {
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
      },
      this,
    );
  }

  private _queue: Queue;

  get queue() {
    return this._queue;
  }

  get duration() {
    // normalise duration when the media-info is not available
    if (super.duration <= 0) {
      const duration_seconds =
        this.now_playing?.object.song.videoDetails.lengthSeconds;

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

    this._queue = new Queue({ app: options.app });

    this._queue.connect(
      "notify::current",
      this.current_track_changed_cb.bind(this),
    );

    // when the queue wants to play, that means the next track will get played
    // automatically
    this.queue.connect("play", () => {
      this.save_playback_state(true, 0);
    });

    // restore state

    this.load_settings_state().catch(console.error);

    Settings.connect("changed::audio-quality", this.update_song_uri.bind(this));
    Settings.connect("changed::video-quality", this.update_song_uri.bind(this));

    Settings.bind("volume", this, "volume", Gio.SettingsBindFlags.DEFAULT);

    Settings.bind("muted", this, "muted", Gio.SettingsBindFlags.DEFAULT);
  }

  // property: current-meta

  private _now_playing: ObjectContainer<TrackMetadata> | null = null;

  get now_playing() {
    return this._now_playing;
  }

  // whether we should add the current track to history once played
  private added_to_playback_history = false;

  vfunc_play() {
    super.vfunc_play();

    // adding the current track to the playback history
    const song = this.now_playing?.object.song;

    if (song) {
      if (!this.added_to_playback_history && get_option("auth").has_token()) {
        // add history entry, but don't wait for the promise to resolve
        add_history_item(song).catch((err) => {
          console.error("Couldn't add track to playback history", err);
        });

        this.added_to_playback_history = true;
      }
    }

    return true;
  }

  private loading_controller: AbortController | null = null;

  private _loading_track: string | null = null;

  get loading_track() {
    return this._loading_track;
  }

  private async load_new_track_metadata(video_id: string) {
    this.loading_controller?.abort();
    this.loading_controller = new AbortController();

    // start loading the current track
    this._loading_track = video_id;
    this.notify("loading-track");

    const [song, meta] = await Promise.all([
      get_song(video_id, {
        signal: this.loading_controller.signal,
      }),
      get_queue(video_id, null, { autoplay: false, radio: false }),
    ]);

    this._now_playing = new ObjectContainer<TrackMetadata>({
      song,
      track: meta.tracks[0],
      meta,
    });
    this.notify("now-playing");

    const uri = get_song_uri(song);

    const info = await this.discover_uri(uri, this.loading_controller.signal);

    this.set_stream_info(info);

    this.added_to_playback_history = false;
  }

  private async load_new_track() {
    const track = this.queue.current?.object;

    // stop the currently playing track
    if (!track) {
      this.unprepare();
      this._now_playing = null;
      this.notify("now-playing");
      return;
    }

    const current_track = this.now_playing?.object.track;

    // if the requested track is already playing, just resume playback
    if (current_track?.videoId == track.videoId) return this.play();

    // the track we are trying to load is already loading
    if (this._loading_track == track.videoId) return;

    this.stop();

    this.is_buffering = true;

    await this.load_new_track_metadata(track.videoId);
  }

  private current_track_changed_cb() {
    this._play.set_video_track_enabled(this.queue.current_is_video);

    const current = this.queue.current?.object;

    const now_playing_videoId = this.now_playing?.object.track.videoId;
    const counterpart_videoId = current?.counterpart?.videoId;

    // we are switching counterparts (from track to video)
    if (
      counterpart_videoId &&
      counterpart_videoId === now_playing_videoId &&
      current.duration_seconds
    ) {
      // try to seek to the same position (for example 40%)
      this.save_playback_state(
        undefined,
        (this.initial_seek_to =
          (this.timestamp / this.duration) *
          (current.duration_seconds * Gst.MSECOND)),
      );
    }

    void this.load_new_track()
      .then(() => {
        this.save_state_settings();
      })
      .catch((error) => {
        // TODO: maybe play the next track
        if (error instanceof DOMException && error.name == "AbortError") return;

        console.error("couldn't load current track", error);
      });
  }

  async refresh_uri() {
    const track = this.now_playing?.object.track;

    if (!track?.videoId) return;

    this.initial_seek_to = this.timestamp;

    this.loading_controller?.abort();
    this.loading_controller = null;

    this.loading_controller = new AbortController();

    const song = await get_song(track.videoId, {
      signal: this.loading_controller?.signal,
    }).catch((error) => {
      if (error instanceof DOMException && error.name == "AbortError") return;

      this.unprepare();
      console.error("Couldn't refresh URI", error);
    });

    if (!song) return;

    if (this.now_playing) {
      this._now_playing = new ObjectContainer<TrackMetadata>({
        ...this.now_playing.object,
        song,
      });
      this.notify("now-playing");
    }

    this.refreshed_uri = true;

    this.update_song_uri();
  }

  protected eos_cb(_play: GstPlay.Play) {
    const previous_metadata = [
      this.has_audio,
      this.has_video,
      this.seekable,
      this.duration,
    ] as const;

    if (super.eos_cb(_play)) {
      // repeat the current track
      if (this.queue.repeat === RepeatMode.ONE) {
        // Reprepare the current track if there is no next track, or if the current track will repeat
        this.stream_prepared(...previous_metadata);
        this.play();
      } else {
        this.queue.next();
      }
    }

    return true;
  }

  save_state_settings() {
    if (!this.queue.current?.object) {
      return null;
    }

    const get_tracks = (list: Gio.ListStore<ObjectContainer<QueueTrack>>) => {
      return list_model_to_array(list)
        .map((container) => container.object)
        .filter(Boolean)
        .map((track) => track?.videoId) as string[];
    };

    PlayerStateSettings.set_boolean("shuffle", this.queue.shuffle);
    PlayerStateSettings.set_enum("repeat", this.queue.repeat);
    PlayerStateSettings.set_uint("position", this.queue.position);
    PlayerStateSettings.set_value(
      "tracks",
      GLib.Variant.new("as", get_tracks(this.queue.list)),
    );
    PlayerStateSettings.set_value(
      "original",
      GLib.Variant.new("as", get_tracks(this.queue._original)),
    );
    PlayerStateSettings.set_string("playlist-id", this.queue.playlist_id ?? "");
    PlayerStateSettings.set_string(
      "playlist-name",
      this.queue.playlist_name ?? "",
    );
  }

  private async load_settings_state() {
    const tracks_ids =
      PlayerStateSettings.get_value<"as">("tracks").deep_unpack();
    const original_ids =
      PlayerStateSettings.get_value<"as">("original").deep_unpack();

    if (tracks_ids.length == 0) return;

    this.queue._shuffle = PlayerStateSettings.get_boolean("shuffle");
    this.queue.repeat = PlayerStateSettings.get_enum("repeat");

    const [tracks, original] = await Promise.all([
      get_queue_tracks(tracks_ids),
      get_queue_tracks(original_ids),
    ]);

    this.queue.list.splice(
      0,
      0,
      tracks.map((track) => new ObjectContainer(track)),
    );

    this.queue._original.splice(
      0,
      0,
      original.map((track) => new ObjectContainer(track)),
    );

    this.queue.set_queue({
      playlistId: PlayerStateSettings.get_string("playlist-id"),
      playlist: PlayerStateSettings.get_string("playlist-name"),
      chips: [],
      tracks,
    } as Partial<MuseQueue> as MuseQueue);

    this.queue.change_position(PlayerStateSettings.get_uint("position"));
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
          // it's clear the user doesn't want playback lol
          this.was_playing = false;
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
        name: "increase-volume",
        parameter_type: "i",
        activate: (_, param) => {
          if (param) {
            this.increase_volume(param.get_int32());
          }
          this.cubic_volume = Math.min(1, this.cubic_volume + 0.1);
        },
      },
      {
        name: "volume-down",
        activate: () => {
          this.cubic_volume = Math.max(0, this.cubic_volume - 0.1);
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

  skip_seconds(seconds: number) {
    const new_timestamp = Math.max(this.timestamp + seconds * Gst.MSECOND, 0);

    if (new_timestamp < this.duration) {
      this.seek(new_timestamp);
    } else {
      this.queue.next();
    }
  }

  increase_volume(value: number) {
    this.cubic_volume += value;
  }

  private set_subtitle_index(index: number) {
    if (index < 0) {
      this._play.set_subtitle_track_enabled(false);
      return;
    }

    this._play.set_subtitle_track(index);
    this._play.set_subtitle_track_enabled(true);
  }

  /**
   * Refresh the currently playing URI.
   * This is useful in case the user changed their preference about quality
   * or when an error happens and it's necessary to fetch a new URI
   */
  private update_song_uri() {
    const song = this.now_playing?.object.song;
    if (!song) return;

    const uri = get_song_uri(song);
    if (uri === this._play.uri) return;

    this.save_playback_state();

    this.is_buffering = true;

    this._play.uri = uri;
  }
}

export interface TrackMetadata {
  song: Song;
  track: QueueTrack;
  meta: Omit<MuseQueue, "tracks">;
}

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
        return (
          quality === VideoQuality.auto ||
          format.video_quality == VideoQuality[quality]
        );
      } else if (!video && format_has_audio(format)) {
        return (
          quality === AudioQuality.auto ||
          format.audio_quality == AudioQuality[quality]
        );
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
    best_formats = get_song_formats(video, formats, best_quality);

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

  return `data:application/dash+xml;base64,${btoa(
    convert_formats_to_dash({
      ...song,
      adaptive_formats: [],
      formats: total_formats,
    }),
  )}`;
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
