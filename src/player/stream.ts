import Gst from "gi://Gst";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";
import GstVideo from "gi://GstVideo";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GstAudio from "gi://GstAudio";
import GstPbUtils from "gi://GstPbutils";

import { add_toast } from "src/util/window";
import { hold_application, release_application } from "src/util/hold";

import { MuzikaPlaySignalAdapter } from "./signal-adapter";

import { Queue } from "./queue";

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
        is_buffering: GObject.param_spec_boolean(
          "is-buffering",
          "Is Buffering",
          "Whether the player is buffering",
          false,
          GObject.ParamFlags.READWRITE,
        ),
        paintable: GObject.param_spec_object(
          "paintable",
          "Paintable",
          "The GdkPaintable representing the video",
          Gdk.Paintable.$gtype,
          GObject.ParamFlags.READWRITE,
        ),
        media_info: GObject.param_spec_object(
          "media-info",
          "Media Info",
          "The media info",
          GstPlay.PlayMediaInfo.$gtype,
          GObject.ParamFlags.READABLE,
        ),
        cubic_volume: GObject.param_spec_double(
          "cubic-volume",
          "Cubic Volume",
          "The volume that is suitable for display",
          0.0,
          1.0,
          1.0,
          GObject.ParamFlags.READWRITE,
        ),
      },
    }, this);
  }

  paintable!: Gdk.Paintable;

  constructor() {
    super();

    this._play = new GstPlay.Play();

    const pipeline = this._play.get_pipeline() as Gst.Pipeline;
    let flags = pipeline.flags;
    // add download flag
    flags |= 0x00000080;
    pipeline.flags = flags;

    const play_config = this._play.get_config();
    GstPlay.Play.config_set_seek_accurate(play_config, true);
    this._play.set_config(play_config);

    const adapter = new MuzikaPlaySignalAdapter(this._play);

    adapter.connect("buffering", this.buffering_cb.bind(this));
    adapter.connect("end-of-stream", this.eos_cb.bind(this));
    adapter.connect("error", this.error_cb.bind(this));
    adapter.connect("state-changed", this.state_changed_cb.bind(this));
    adapter.connect("position-updated", this.position_updated_cb.bind(this));
    adapter.connect("duration-changed", this.duration_changed_cb.bind(this));
    adapter.connect(
      "media-info-updated",
      this.media_info_updated_cb.bind(this),
    );
    adapter.connect("volume-changed", this.volume_changed_cb.bind(this));
    adapter.connect("mute-changed", this.mute_changed_cb.bind(this));
    adapter.connect("seek-done", this.seek_done_cb.bind(this));
    adapter.connect("warning", (_object, error: GLib.Error) => {
      console.warn("player warning", error.code, error.message);
    });

    const sink = Gst.ElementFactory.make(
      "gtk4paintablesink",
      "sink",
    )! as GstVideo.VideoSink;

    if (!sink) {
      throw new Error(
        "Failed to create gtk4paintablesink, is that installed on your system?",
      );
    }

    sink.bind_property(
      "paintable",
      this,
      "paintable",
      GObject.BindingFlags.SYNC_CREATE,
    );

    this._play.pipeline.set_property("video-sink", sink);
  }

  // cubic volume

  get cubic_volume() {
    return get_cubic_volume(this.volume);
  }

  set cubic_volume(value: number) {
    this.volume = get_linear_volume(value);
  }

  // UTILS

  protected _play: GstPlay.Play;

  protected _initial_seek_to: number | null = null;

  get initial_seek_to() {
    return this._initial_seek_to;
  }

  set initial_seek_to(initial_seek_to: number | null) {
    this._initial_seek_to = initial_seek_to;

    this.notify("timestamp");
  }

  private do_initial_seek() {
    if (this.initial_seek_to !== null) {
      this.seek(this.initial_seek_to);
      this.initial_seek_to = null;
    }
  }

  get timestamp() {
    if (this.initial_seek_to != null) {
      return this.initial_seek_to;
    }

    return super.timestamp;
  }

  // PROPERTIES

  // property: media-info

  protected _media_info: GstPlay.PlayMediaInfo | null = null;

  get media_info() {
    return this._media_info;
  }

  // property: buffering

  is_buffering = false;

  // property: playing

  vfunc_play() {
    this._play.play();
    return true;
  }

  vfunc_pause() {
    this._play.pause();
    return true;
  }

  resume() {
    if (this.playing) {
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

  // first try to refresh URI when an error occurs

  protected refreshed_uri = false;

  protected async refresh_uri(): Promise<void> {
    this.refreshed_uri = true;
  }

  // FUNCTIONS

  // error functions

  on_stream_error_cb(error: GLib.Error): void {
    // TODO: reconsider if this is necessary
    // if (this.refreshed_uri === false) {
    //   this.refresh_uri();

    //   return;
    // }

    add_toast("An error happened during playback");
    console.error(error);

    this.gerror(error);
  }

  // seek

  vfunc_seek(timestamp: number): void {
    this.update(timestamp);
    this._play.seek(Math.trunc(timestamp * Gst.USECOND));
  }

  vfunc_update_audio(muted: boolean, volume: number): void {
    this._play.mute = muted;
    this._play.volume = volume;
    this.notify("cubic-volume");
  }

  // handlers

  private buffering_cb(_play: GstPlay.Play, percent: number): void {
    if (percent < 100) {
      if (!this.is_buffering && this.playing) {
        this._play.pause();

        this.is_buffering = true;
      }
    } else {
      this.is_buffering = false;

      if (this.playing) this._play.play();
    }
  }

  private position_updated_cb(_play: GstPlay.Play, position: number): void {
    if (this.seeking && position === 0) {
      return;
    }

    if (this.prepared) {
      this.update(position / Gst.USECOND);
    }
  }

  private duration_changed_cb(_play: GstPlay.Play): void {
    this.notify("duration");
  }

  private state_changed_cb(
    _play: GstPlay.Play,
    state: GstPlay.PlayState,
  ): void {
    if (state == GstPlay.PlayState.BUFFERING) {
      this.is_buffering = true;
    } else if (this.is_buffering && state != GstPlay.PlayState.STOPPED) {
      this.is_buffering = false;
    }
  }

  private error_cb(_play: GstPlay.Play, error: GLib.Error): void {
    this.on_stream_error_cb(error);
  }

  protected eos_cb(_play: GstPlay.Play): boolean {
    if (this._play.duration - this._play.position >= Gst.SECOND) {
      // this means an error occured, we might need to refresh the uri
      if (!this.refreshed_uri) {
        this.refresh_uri();
        return false;
      }
    }

    if (this.prepared) {
      this.stream_ended();
      this.stream_unprepared();
    }

    return true;
  }

  protected media_info_updated_cb(
    _play: GstPlay.Play,
    info: GstPlay.PlayMediaInfo,
  ): void {
    this._media_info = info;
    this.notify("media-info");
  }

  private volume_changed_cb(_play: GstPlay.Play): void {
    this.notify("volume");
    this.notify("cubic-volume");
  }

  private mute_changed_cb(_play: GstPlay.Play): void {
    this.notify("muted");
  }

  private seek_done_cb(_play: GstPlay.Play, timestamp: number): void {
    if (this.seeking) {
      this.seek_success();
    }

    if (this.prepared) {
      this.update(timestamp / Gst.USECOND);
    }
  }

  private discover_controller: AbortController | null = null;

  protected set_uri(uri: string): void {
    this.discover_controller?.abort();
    this.discover_controller = null;

    this.discover_controller = new AbortController();

    this.discover_uri(uri)
      .then((info) => {
        const was_playing = this.playing;

        if (this.is_prepared()) this.unprepare();

        this.refreshed_uri = false;

        hold_application();

        this.stream_prepared(
          info.get_audio_streams().length > 0,
          info.get_video_streams().length > 0,
          info.get_seekable(),
          info.get_duration() / Gst.USECOND,
        );

        this._play.set_uri(uri);

        this.pause();

        if (was_playing) {
          this.play();
        }

        this.do_initial_seek();
      });
  }

  stop() {
    this._play.pipeline.set_state(Gst.State.NULL);
  }

  unprepare() {
    if (this.prepared) {
      this.stream_unprepared();
    }

    this.stop();
    release_application();
  }

  private async discover_uri(uri: string, signal?: AbortSignal) {
    const discoverer = new GstPbUtils.Discoverer();

    signal?.addEventListener("abort", () => {
      discoverer.stop();
    });

    discoverer.start();
    discoverer.discover_uri_async(uri);

    return new Promise<GstPbUtils.DiscovererInfo>((resolve, reject) => {
      const handler = discoverer.connect(
        "discovered",
        (_source, info, error) => {
          discoverer.disconnect(handler);

          switch (info.get_result()) {
            case GstPbUtils.DiscovererResult.OK: {
              const uri = info.get_uri();
              this._play.set_uri(uri);
              resolve(info);
            }
            case GstPbUtils.DiscovererResult.MISSING_PLUGINS:
              reject(
                GLib.Error.new_literal(
                  GstPlay.PlayError,
                  GstPlay.PlayError.FAILED,
                  _(
                    "File uses a format that cannot be played. Additional media codecs may be required.",
                  ),
                ),
              );
            case GstPbUtils.DiscovererResult.ERROR:
              reject(
                error ??
                  GLib.Error.new_literal(
                    GstPlay.PlayError,
                    GstPlay.PlayError.FAILED,
                    _(
                      "An error happened while trying to get information about the file. Please try again.",
                    ),
                  ),
              );
            case GstPbUtils.DiscovererResult.URI_INVALID:
              reject(
                error ??
                  GLib.Error.new_literal(
                    GstPlay.PlayError,
                    GstPlay.PlayError.FAILED,
                    _("File uses an invalid URI"),
                  ),
              );
            case GstPbUtils.DiscovererResult.TIMEOUT:
              reject(
                error ??
                  GLib.Error.new_literal(
                    GstPlay.PlayError,
                    GstPlay.PlayError.FAILED,
                    _(
                      "Reading the file's information timed out. Please try again.",
                    ),
                  ),
              );
          }
        },
      );
    });
  }
}

export function get_linear_volume(value: number) {
  return GstAudio.stream_volume_convert_volume(
    GstAudio.StreamVolumeFormat.CUBIC,
    GstAudio.StreamVolumeFormat.LINEAR,
    value,
  );
}

export function get_cubic_volume(value: number) {
  return GstAudio.stream_volume_convert_volume(
    GstAudio.StreamVolumeFormat.LINEAR,
    GstAudio.StreamVolumeFormat.CUBIC,
    value,
  );
}
