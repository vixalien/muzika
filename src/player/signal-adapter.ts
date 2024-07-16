import Gst from "gi://Gst";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import GstPlay from "gi://GstPlay";

type GTypeToType<Y extends GObject.GType> =
  Y extends GObject.GType<infer T> ? T : never;

type GTypeArrayToTypeArray<Y extends readonly GObject.GType[]> = {
  [K in keyof Y]: GTypeToType<Y[K]>;
};

export class MuzikaPlaySignalAdapter extends GObject.Object {
  private static events = {
    buffering: [GObject.TYPE_INT],
    "duration-changed": [GObject.TYPE_INT],
    "end-of-stream": [],
    error: [GLib.Error.$gtype, Gst.Structure.$gtype],
    "media-info-updated": [GstPlay.PlayMediaInfo.$gtype],
    "mute-changed": [GObject.TYPE_BOOLEAN],
    "position-updated": [GObject.TYPE_DOUBLE],
    "seek-done": [GObject.TYPE_DOUBLE],
    "state-changed": [GstPlay.PlayState.$gtype],
    "uri-loaded": [GObject.TYPE_STRING],
    "video-dimensions-changed": [GObject.TYPE_INT, GObject.TYPE_INT],
    "volume-changed": [GObject.TYPE_INT],
    warning: [GLib.Error.$gtype, Gst.Structure.$gtype],
  } as const;

  static {
    GObject.registerClass(
      {
        GTypeName: "MuzikaPlaySignalAdapter",
        Signals: Object.fromEntries(
          Object.entries(this.events).map(([name, types]) => [
            name,
            {
              param_types: types,
            },
          ]),
        ),
      },
      this,
    );
  }
  private _play: GstPlay.Play;

  get play(): GstPlay.Play {
    return this._play;
  }

  constructor(play: GstPlay.Play) {
    super();

    this._play = play;

    const bus = this._play.get_message_bus();
    bus.add_signal_watch_full(GLib.PRIORITY_DEFAULT_IDLE);

    bus.connect("message", this.on_message.bind(this));
  }

  private on_message(_: GstPlay.Play, message: Gst.Message) {
    if (!GstPlay.Play.is_play_message(message)) {
      return;
    }

    const structure = message.get_structure();

    if (!structure) return;

    const type = structure.get_enum(
      "play-message-type",
      GstPlay.PlayMessage.$gtype,
    );

    if (!type[0] || structure.get_name() !== "gst-play-message-data") {
      return;
    }

    switch (type[1] as GstPlay.PlayMessage) {
      case GstPlay.PlayMessage.URI_LOADED:
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.emit_message("uri-loaded", [structure.get_string("uri")!]);
        break;
      case GstPlay.PlayMessage.POSITION_UPDATED:
        this.emit_message("position-updated", [
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          GstPlay.play_message_parse_position_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.DURATION_CHANGED:
        this.emit_message("duration-changed", [
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          GstPlay.play_message_parse_duration_updated(message)!,
        ]);
        break;
      case GstPlay.PlayMessage.STATE_CHANGED:
        this.emit_message("state-changed", [
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        // eslint-disable-next-line no-case-declarations
        const error = GstPlay.play_message_parse_error(message);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.emit_message("error", [error[0]!, error[1]!]);
        break;
      case GstPlay.PlayMessage.WARNING:
        // eslint-disable-next-line no-case-declarations
        const warning = GstPlay.play_message_parse_warning(message);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
          GstPlay.play_message_parse_muted_changed(message),
        ]);
        break;
      case GstPlay.PlayMessage.SEEK_DONE:
        this.emit_message("seek-done", [
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          GstPlay.play_message_parse_position_updated(message)!,
        ]);
        break;
    }
  }

  private emit_message<
    Name extends keyof (typeof MuzikaPlaySignalAdapter)["events"],
    Types extends (typeof MuzikaPlaySignalAdapter)["events"][Name],
  >(name: Name, args: GTypeArrayToTypeArray<Types>) {
    this.emit(name as string, ...(args as GTypeToType<Types[number]>[]));
  }
}
