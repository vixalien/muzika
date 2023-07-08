import Gst from "gi://Gst";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";
import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";

import { debounce } from "lodash-es";

import {
  Queue,
  QueueMeta,
  QueueSettings,
  RepeatMode,
  tracks_to_meta,
} from "./queue.js";
import {
  add_history_item,
  AudioFormat,
  get_option,
  get_song,
  Song,
} from "../muse.js";
import { Application, Settings } from "../application.js";
import { ObjectContainer } from "../util/objectcontainer.js";
import { AddActionEntries } from "src/util/action.js";
import { store } from "src/util/giofilestore.js";
import { list_model_to_array } from "src/util/list.js";
import { PlayMediaInfo } from "gi-types/gstplay1.js";

const preferred_quality: AudioFormat["audio_quality"] = "medium";
const preferred_format: AudioFormat["audio_codec"] = "opus";

type MaybeAdaptiveFormat = AudioFormat & {
  adaptive: boolean;
};

GLib.setenv("GST_PLAY_USE_PLAYBIN3", "1", false);

Gst.init(null);

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

  video_widget: Gdk.Paintable;

  constructor() {
    super();

    this._play = new GstPlay.Play();

    const sink = Gst.ElementFactory.make("gtk4paintablesink", "sink")!;

    if (!sink) {
      throw new Error("Failed to create sink");
    }

    this._play.pipeline.set_property("video-sink", sink);

    this.video_widget = (sink as any).widget;

    const adapter = GstPlay.PlaySignalAdapter.new(this._play);

    adapter.connect("buffering", this.buffering_cb.bind(this));
    adapter.connect("end-of-stream", this.eos_cb.bind(this));
    adapter.connect("error", this.error_cb.bind(this));
    adapter.connect("state-changed", this.state_changed_cb.bind(this));
    adapter.connect("uri-loaded", this.uri_loaded_cb.bind(this));
    adapter.connect("position-updated", this.position_updated_cb.bind(this));
    adapter.connect("duration-changed", this.duration_changed_cb.bind(this));
    adapter.connect("state-changed", this.state_changed_cb.bind(this));
    adapter.connect(
      "media-info-updated",
      this.media_info_updated_cb.bind(this),
    );
    adapter.connect("volume-changed", this.volume_changed_cb.bind(this));
    adapter.connect("mute-changed", this.mute_changed_cb.bind(this));
    adapter.connect("seek-done", this.seek_done_cb.bind(this));
  }

  // UTILS

  private _play: GstPlay.Play;

  private get_playbin() {
    return this._play.pipeline;
  }

  private update_property<T extends keyof this>(
    property: T,
    value: this[T],
  ): void {
    this[property] = value;
    this.notify(property as string);
  }

  // PROPERTIES

  // property: buffering

  private _is_buffering = false;

  get is_buffering() {
    return this._is_buffering;
  }

  // property: duration

  get duration() {
    return this._play.duration;
  }

  // property: ended

  private _ended = false;

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
    return this._play.media_info.get_number_of_audio_streams() > 0;
  }

  // property: has-video

  get has_video() {
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

  private _playing = false;

  public get playing() {
    return this._playing;
  }

  public set playing(value) {
    if (value) {
      this.play();
    } else {
      this.pause();
    }
  }

  // property: playing

  // get prepared() {
  //   const state = this.get_state();

  //   if (!state) return false;

  //   return state >= Gst.State.READY;
  // }

  // property: seekable

  get seekable() {
    return true;
  }

  // property: seeking

  private _seeking = false;

  public get seeking() {
    return this._seeking;
  }

  // property: timestamp

  get timestamp() {
    return this._play.position / Gst.MSECOND;
  }

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
    this.update_property("error", error);

    // TODO: cancel pending seeks
    this._play.stop();
    this.stream_unprepared();

    this.playing = false;
  }

  // play functions

  vfunc_play() {
    if (this._playing) return false;

    this._play.play();

    this._playing = true;
    this.notify("playing");

    return true;
  }

  pause(): void {
    if (!this._playing) return;

    this._play.pause();

    this._playing = true;
    this.notify("playing");
  }

  // seek

  vfunc_seek(timestamp: number): void {
    this.update_property("seeking", true);

    this.seek(timestamp * Gst.MSECOND);
  }

  // handlers

  private buffering_cb(_play: GstPlay.Play, percent: number): void {
    console.log("buffering", percent);

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
    this.stream_prepared(
      true,
      true,
      true,
      this._play.duration / Gst.MSECOND,
    );

    this._ended = false;
    this.notify("ended");
  }

  private position_updated_cb(_play: GstPlay.Play, position: number): void {
    this.update(position / Gst.MSECOND);
  }

  private duration_changed_cb(_play: GstPlay.Play): void {
    this.notify("duration");
  }

  private state_changed_cb(
    _play: GstPlay.Play,
    state: GstPlay.PlayState,
  ): void {
    console.log(
      "state",
      GObject.enum_to_string(GstPlay.PlayState.$gtype, state),
    );

    if (state == GstPlay.PlayState.BUFFERING) {
      this._is_buffering = true;
      this.notify("is-buffering");
    } else if (this.is_buffering) {
      this._is_buffering = false;
      this.notify("is-buffering");
    }

    if (state == GstPlay.PlayState.STOPPED) {
      this.stream_unprepared();
    } else {
      if (!this.prepared) {
        this.stream_prepared(
          this.has_audio,
          this.has_video,
          true,
          this._play.duration / Gst.MSECOND,
        );

        this._ended = false;
        this.notify("ended");
      }
    }
  }

  private error_cb(_play: GstPlay.Play, error: GLib.Error): void {
    this.gerror(error);
  }

  private eos_cb(_play: GstPlay.Play): void {
    this.stream_ended();

    this._ended = true;
    this.notify("ended");
  }

  private media_info_updated_cb(
    _play: GstPlay.Play,
    info: PlayMediaInfo,
  ): void {
    this.notify("has-audio");
    this.notify("has-video");
  }

  private volume_changed_cb(_play: GstPlay.Play): void {
    this.notify("volume");
  }

  private mute_changed_cb(_play: GstPlay.Play): void {
    this.notify("muted");
  }

  private seek_done_cb(_play: GstPlay.Play): void {
    this.update_property("seeking", false);

    this.seek_success();
  }

  set_uri(uri: string): void {
    this._play.uri = uri;
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
      },
    }, this);
  }
}
