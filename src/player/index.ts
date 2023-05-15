import Gst from "gi://Gst";
import GObject from "gi://GObject";

import { Queue } from "./queue.js";
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
  track: QueueTrack;
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
      },
    }, this);
  }

  player: Gst.Element;
  fakesink: Gst.Element;
  // URL: string;

  private _queue: Queue = new Queue();

  _current: ObjectContainer<TrackMetadata> | null = null;

  get current() {
    return this._current;
  }

  get queue(): Queue {
    return this._queue;
  }

  constructor() {
    super();

    if (!Gst.is_initialized()) {
      Gst.init(null);
    }

    // this.URL =
    //   "https://rr2---sn-3ugf-3bae.googlevideo.com/videoplayback?expire=1684116886&ei=NkFhZOXwBOewxN8PgMCq0AE&ip=105.178.113.196&id=o-AJZyWGY07fxtXZAB4z-phw5z8_kCBt2PrwT-HKU-tA6-&itag=249&source=youtube&requiressl=yes&mh=t_&mm=31%2C29&mn=sn-3ugf-3bae%2Csn-hc57en76&ms=au%2Crdu&mv=m&mvi=2&pl=24&ctier=A&pfa=5&gcr=rw&initcwndbps=205000&hightc=yes&vprv=1&svpuc=1&mime=audio%2Fwebm&gir=yes&clen=2557161&dur=395.701&lmt=1676294036192731&mt=1684094944&fvip=3&keepalive=yes&fexp=24007246&c=ANDROID_MUSIC&txp=2318224&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cctier%2Cpfa%2Cgcr%2Chightc%2Cvprv%2Csvpuc%2Cmime%2Cgir%2Cclen%2Cdur%2Clmt&sig=AOq0QJ8wRQIhAIxTYO6FeFp0oyvJ-SM6-W6-diCjqnPypdvQaucI3kNYAiAD8dyOPHjyTY7gPTdBjWf5j04IyaijzzUdMFspeQTKOw%3D%3D&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AG3C_xAwRAIgS80eCrw-zKeUDpEdingiCtoksZfBEgaAJRJV2VogU_ICIBW0oMyoIj5fqwGL_8V_GFjshLxEi4ZqgZaqJM0NsuGT";

    this.player = Gst.ElementFactory.make("playbin", "player")!;
    this.fakesink = Gst.ElementFactory.make("fakesink", "fakesink")!;

    this.player.set_property("video-sink", this.fakesink);

    const bus = this.player.get_bus()!;
    bus.add_signal_watch();
    bus.connect("message", this.on_message.bind(this));
  }

  play() {
    this.player.set_state(Gst.State.PLAYING);
  }

  pause() {
    this.player.set_state(Gst.State.PAUSED);
  }

  play_pause() {
    const state = this.player.get_state(Gst.CLOCK_TIME_NONE)[1];

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
    this.player.set_state(Gst.State.NULL);
  }

  async play_song(track: QueueTrack) {
    const song = await get_song(track.videoId);
    const format = this.negotiate_best_format(song);

    this._current = ObjectContainer.new({ song, track });
    this.notify("current");

    this.stop();
    this.player.set_property("uri", format.url);
    this.play();
  }

  private on_message(_bus: Gst.Bus, message: Gst.Message) {
    const type = message.type;

    if (type === Gst.MessageType.EOS) {
      this.next();
    } else if (type == Gst.MessageType.ERROR) {
      this.stop();
      const [error, debug] = message.parse_error();
      console.log("Error: ", error, debug);
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
