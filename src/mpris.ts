import Gio from "gi://Gio";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gst from "gi://Gst";
import Gtk from "gi://Gtk?version=4.0";

import { Application } from "./application";
import { Player } from "./player";
import { RepeatMode } from "./player/queue";
import type { LikeStatus } from "libmuse/types/parsers/songs";

// bus_get
Gio._promisify(Gio, "bus_get", "bus_get_finish");

const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);

const MPRIS_XML = `
<!DOCTYPE node
  PUBLIC '-//freedesktop//DTD D-BUS Object Introspection 1.0//EN' 'http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd'>
<node>
  <interface name='org.freedesktop.DBus.Introspectable'>
    <method name='Introspect'>
      <arg name='data' direction='out' type='s' />
    </method>
  </interface>
  <interface name='org.freedesktop.DBus.Properties'>
    <method name='Get'>
      <arg name='interface' direction='in' type='s' />
      <arg name='property' direction='in' type='s' />
      <arg name='value' direction='out' type='v' />
    </method>
    <method name='Set'>
      <arg name='interface_name' direction='in' type='s' />
      <arg name='property_name' direction='in' type='s' />
      <arg name='value' direction='in' type='v' />
    </method>
    <method name='GetAll'>
      <arg name='interface' direction='in' type='s' />
      <arg name='properties' direction='out' type='a{sv}' />
    </method>
    <signal name='PropertiesChanged'>
      <arg name='interface_name' type='s' />
      <arg name='changed_properties' type='a{sv}' />
      <arg name='invalidated_properties' type='as' />
    </signal>
  </interface>
  <interface name='org.mpris.MediaPlayer2'>
    <method name='Raise'>
    </method>
    <method name='Quit'>
    </method>
    <property name='CanQuit' type='b' access='read' />
    <property name='Fullscreen' type='b' access='readwrite' />
    <property name='CanRaise' type='b' access='read' />
    <property name='HasTrackList' type='b' access='read' />
    <property name='Identity' type='s' access='read' />
    <property name='DesktopEntry' type='s' access='read' />
    <property name='SupportedUriSchemes' type='as' access='read' />
    <property name='SupportedMimeTypes' type='as' access='read' />
  </interface>
  <interface name='org.mpris.MediaPlayer2.Player'>
    <method name='Next' />
    <method name='Previous' />
    <method name='Pause' />
    <method name='PlayPause' />
    <method name='Stop' />
    <method name='Play' />
    <method name='Seek'>
      <arg direction='in' name='Offset' type='x' />
    </method>
    <method name='SetPosition'>
      <arg direction='in' name='TrackId' type='o' />
      <arg direction='in' name='Position' type='x' />
    </method>
    <method name='OpenUri'>
      <arg direction='in' name='Uri' type='s' />
    </method>
    <signal name='Seeked'>
      <arg name='Position' type='x' />
    </signal>
    <property name='PlaybackStatus' type='s' access='read' />
    <property name='LoopStatus' type='s' access='readwrite' />
    <property name='Rate' type='d' access='readwrite' />
    <property name='Shuffle' type='b' access='readwrite' />
    <property name='Metadata' type='a{sv}' access='read'>
    </property>
    <property name='Position' type='x' access='read' />
    <property name='MinimumRate' type='d' access='read' />
    <property name='MaximumRate' type='d' access='read' />
    <property name='CanGoNext' type='b' access='read' />
    <property name='CanGoPrevious' type='b' access='read' />
    <property name='CanPlay' type='b' access='read' />
    <property name='CanPause' type='b' access='read' />
    <property name='CanSeek' type='b' access='read' />
    <property name='CanControl' type='b' access='read' />
  </interface>
  <interface name='org.mpris.MediaPlayer2.TrackList'>
    <method name='GetTracksMetadata'>
      <arg direction='in' name='TrackIds' type='ao' />
      <arg direction='out' name='Metadata' type='aa{sv}'>
      </arg>
    </method>
    <method name='AddTrack'>
      <arg direction='in' name='Uri' type='s' />
      <arg direction='in' name='AfterTrack' type='o' />
      <arg direction='in' name='SetAsCurrent' type='b' />
    </method>
    <method name='RemoveTrack'>
      <arg direction='in' name='TrackId' type='o' />
    </method>
    <method name='GoTo'>
      <arg direction='in' name='TrackId' type='o' />
    </method>
    <signal name='TrackListReplaced'>
      <arg name='Tracks' type='ao' />
      <arg name='CurrentTrack' type='o' />
    </signal>
    <property name='Tracks' type='ao' access='read' />
    <property name='CanEditTracks' type='b' access='read' />
  </interface>
  <interface name='org.mpris.MediaPlayer2.Playlists'>
    <method name='ActivatePlaylist'>
      <arg direction="in" name="PlaylistId" type="o" />
    </method>
    <method name='GetPlaylists'>
      <arg direction='in' name='Index' type='u' />
      <arg direction='in' name='MaxCount' type='u' />
      <arg direction='in' name='Order' type='s' />
      <arg direction='in' name='ReverseOrder' type='b' />
      <arg direction='out' name='Playlists' type='a(oss)' />
    </method>
    <property name='PlaylistCount' type='u' access='read' />
    <property name='Orderings' type='as' access='read' />
    <property name='ActivePlaylist' type='(b(oss))' access='read' />
    <signal name='PlaylistChanged'>
      <arg name='Playlist' type='(oss)' />
    </signal>
  </interface>
</node>
`;

export class DBusInterface {
  connection!: Gio.DBusConnection;

  constructor(
    private name: string,
    private path: string,
    private application: Gtk.Application,
  ) {
    Gio.bus_get(Gio.BusType.SESSION, null)
      .then(this.got_bus.bind(this))
      .catch((e: GLib.Error) => {
        console.warn(`Unable to connect to session bus: ${e.message}`);
      });
  }

  private method_outargs = new Map<string, string>();
  private method_inargs = new Map<string, string[]>();
  private signals = new Map<
    string,
    { interface: string; args: Record<string, string> }
  >();

  private got_bus(connection: Gio.DBusConnection) {
    this.connection = connection;

    Gio.bus_own_name_on_connection(
      this.connection,
      this.name,
      Gio.BusNameOwnerFlags.NONE,
      null,
      null,
    );

    for (const iface of Gio.DBusNodeInfo.new_for_xml(MPRIS_XML).interfaces) {
      for (const method of iface.methods) {
        this.method_outargs.set(
          method.name,
          `(` + method.out_args.map((arg) => arg.signature).join("") +
            `)`,
        );

        this.method_inargs.set(
          method.name,
          method.in_args.map((arg) => arg.signature),
        );
      }

      for (const signal of iface.signals) {
        this.signals.set(signal.name, {
          interface: iface.name,
          args: Object.fromEntries(
            signal.args.map((arg) => [arg.name, arg.signature]),
          ),
        });
      }

      this.connection.register_object(
        this.path,
        iface,
        this._on_method_call.bind(this),
        null,
        null,
      );
    }
  }

  private _on_method_call(
    connection: Gio.DBusConnection,
    sender: string,
    object_path: string,
    interface_name: string,
    method_name: string,
    parameters: GLib.Variant,
    invocation: Gio.DBusMethodInvocation,
  ) {
    const args = parameters.unpack() as any[];

    this.method_inargs.get(method_name)!.forEach((sig, i) => {
      if (sig === "h") {
        const message = invocation.get_message();
        const fd_list = message.get_unix_fd_list()!;
        args[i] = fd_list.get(0);
      }
    });

    const method_snake_name = DBusInterface._camel_to_snake(
      method_name,
    );

    let result;

    try {
      result = (this[method_snake_name as keyof this] as any)(...args);
    } catch (error) {
      invocation.return_dbus_error(
        interface_name,
        (error as string).toString(),
      );
      return;
    }

    result = [result].flat();

    const out_args = this.method_outargs.get(method_name)!;

    if (out_args != "()") {
      const variant = GLib.Variant.new(out_args, result);
      invocation.return_value(variant);
    } else {
      invocation.return_value(null);
    }
  }

  _dbus_emit_signal(signal_name: string, values: Record<string, any>) {
    if (this.signals.size === 0) return;

    const signal = this.signals.get(signal_name)!;

    const parameters = [];

    for (const [key, signature] of Object.entries(signal.args)) {
      const value = values[key];
      parameters.push(GLib.Variant.new(signature, value));
    }

    const variant = GLib.Variant.new_tuple(parameters as any);

    this.connection.emit_signal(
      null,
      this.path,
      signal.interface,
      signal_name,
      variant,
    );
  }

  static _camel_to_snake(str: string) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

export class MPRIS extends DBusInterface {
  player: Player;

  MEDIA_PLAYER2_IFACE = "org.mpris.MediaPlayer2";
  MEDIA_PLAYER2_PLAYER_IFACE = "org.mpris.MediaPlayer2.Player";

  constructor(public app: Application) {
    super("org.mpris.MediaPlayer2.Muzika", "/org/mpris/MediaPlayer2", app);

    this.player = app.player;

    this.player.queue.connect(
      "notify::current",
      this._on_current_song_changed.bind(this),
    );
    this.player.connect(
      "notify::playing",
      this._on_player_state_changed.bind(this),
    );
    this.player.queue.connect(
      "notify::repeat",
      this._on_repeat_mode_changed.bind(this),
    );
    this.player.queue.connect(
      "notify::shuffle",
      this._on_shuffle_changed.bind(this),
    );
    // this.player.queue.list.connect(
    //   "items-changed",
    //   this._on_player_playlist_changed.bind(this),
    // );
    this.player.connect(
      "seeked",
      this._on_seek_finished.bind(this),
    );
  }

  _get_playback_status() {
    if (this.player.playing) {
      return "Playing";
    } else if (
      this.player.playbin.get_state(Number.MAX_SAFE_INTEGER)[1] ===
        Gst.State.PAUSED
    ) {
      return "Paused";
    } else {
      return "Stopped";
    }
  }

  _get_loop_status() {
    switch (this.player.queue.repeat) {
      case RepeatMode.NONE:
        return "None";
      case RepeatMode.ONE:
        return "Track";
      case RepeatMode.ALL:
        return "Playlist";
    }
  }

  private _like_rank = new Map<LikeStatus, number>([
    ["LIKE", 1],
    ["DISLIKE", -1],
    ["INDIFFERENT", 0],
  ]);

  _get_metadata() {
    const song_dbus_path = this._get_song_dbus_path();

    const track = this.player.queue.current?.item;

    if (!track) {
      return {
        "mpris:trackid": GLib.Variant.new_object_path(song_dbus_path),
      };
    }

    const length = (track.duration_seconds ?? 0) * 1e6;
    const user_rating = this._like_rank.get(track.likeStatus ?? "INDIFFERENT")!;
    const artists = track.artists
      .map((artist) => artist.name)
      .map((artist) => GLib.Variant.new_string(artist));

    const largest_thumbnail = track.thumbnails
      .sort((a, b) => b.width - a.width)[0];

    const metadata = {
      "mpris:trackid": GLib.Variant.new_object_path(song_dbus_path),
      "xesam:url": GLib.Variant.new_string(
        `https://music.youtube.com/watch?v=${track.videoId}`,
      ),
      "mpris:length": GLib.Variant.new_int64(length),
      "xesam:userRating": GLib.Variant.new_double(user_rating),
      "xesam:title": GLib.Variant.new_string(track.title),
      "xesam:album": GLib.Variant.new_string(track.album?.name ?? ""),
      "xesam:artist": GLib.Variant.new_array(
        GLib.VariantType.new("s"),
        artists as any,
      ),
      "xesam:albumArtist": GLib.Variant.new_array(
        GLib.VariantType.new("s"),
        artists as any,
      ),
      "mpris:artUrl": GLib.Variant.new_string(largest_thumbnail.url),
    };

    return metadata;
  }

  _get_song_dbus_path() {
    if (!this.player.queue.current?.item) {
      return "/org/mpris/MediaPlayer2/TrackList/NoTrack";
    } else {
      return `/com/vixalien/muzika/TrackList/${
        hex_encode(this.player.queue.current.item.videoId.replace(/-/g, "_"))
      }`;
    }
  }

  _get_active_playlist() {
    return [false, ["/", "", ""]];
  }

  private _on_current_song_changed() {
    // In repeat song mode, no metadata has changed if the player was
    // already started
    if (this.player.queue.repeat === RepeatMode.ONE) {
      this._seeked(0);
      if (this.player.queue.can_play_previous) {
        return;
      }
    }

    // IDK
    this._on_player_model_changed(this.player.queue.list, 0, 0, 0);
  }

  previous_state = new Map<string, any>();

  _on_player_model_changed(
    model: Gio.ListStore,
    _pos: number,
    _removed: number,
    added: number,
  ) {
    // Don't update the properties if the model has completely changed.
    // These changes will be applied once a new song starts playing.
    if (added == model.n_items) {
      return;
    }

    const properties: Record<string, GLib.Variant> = {
      Metadata: GLib.Variant.new("a{sv}", this._get_metadata()),
    };

    const has_next = this.player.queue.can_play_next;
    if (has_next != this.previous_state.get("can_go_next")) {
      properties.CanGoNext = GLib.Variant.new_boolean(has_next);
      this.previous_state.set("can_go_next", has_next);
    }

    const has_previous = this.player.queue.can_play_previous;
    if (has_previous != this.previous_state.get("can_go_previous")) {
      properties.CanGoPrevious = GLib.Variant.new_boolean(has_previous);
      this.previous_state.set("can_go_previous", has_next);
    }

    if (this.previous_state.get("can_play") != true) {
      properties.CanPause = GLib.Variant.new_boolean(true);
      properties.CanPlay = GLib.Variant.new_boolean(true);
      this.previous_state.set("can_play", true);
    }

    this._properties_changed(this.MEDIA_PLAYER2_PLAYER_IFACE, properties, []);
  }

  private _on_player_state_changed() {
    const status = this._get_playback_status();

    this._properties_changed(
      this.MEDIA_PLAYER2_PLAYER_IFACE,
      {
        PlaybackStatus: GLib.Variant.new_string(status),
      },
      [],
    );
  }

  private _on_shuffle_changed() {
    this._properties_changed(
      this.MEDIA_PLAYER2_PLAYER_IFACE,
      {
        Shuffle: GLib.Variant.new_boolean(this.player.queue.shuffle),
      },
      [],
    );
  }

  private _on_repeat_mode_changed() {
    this._properties_changed(
      this.MEDIA_PLAYER2_PLAYER_IFACE,
      {
        LoopStatus: GLib.Variant.new_string(this._get_loop_status()),
      },
      [],
    );
  }

  private _on_seek_finished(_: Gtk.Widget, position: number) {
    this._seeked(Math.trunc(position / 1e3));
  }

  // private _on_player_playlist_changed() {}

  /// methods

  /** Brings user interface to the front */
  _raise() {
    this.app.activate();
  }

  /** Causes the media player to stop running */
  _quit() {
    this.app.quit();
  }

  /** Skips to the next track in the tracklist */
  _next() {
    this.player.next();
  }

  /** Skips to the previous track in the tracklist */
  _previous() {
    this.player.previous();
  }

  /** Pauses playback */
  _pause() {
    this.player.pause();
  }

  /** Play or Pauses playback */
  _play_pause() {
    this.player.play_pause();
  }

  /** Stop playback */
  _stop() {
    this.player.stop();
  }

  /**
   * Start or resume playback.
   * If there is no track to play, this has no effect
   */
  _play() {
    this.player.play();
  }

  /**
   * Seek forward in the current track
   *
   * Seek is relative to the current player position
   * If the value passed in would mean seeking beyong the end of the track,
   * acts like a call to next
   */
  _seek(offset_variant: GLib.Variant) {
    const offset_msecond = offset_variant.get_int64();

    const current_position_second = (this.player.get_position() ?? 0) /
      Gst.SECOND;
    const new_position_second = current_position_second +
      (offset_msecond / 1e6);

    const duration_second = (this.player.get_duration() ?? 0) / Gst.SECOND;

    if (new_position_second <= duration_second) {
      this.player.raw_seek(new_position_second * Gst.SECOND);
    } else {
      this.player.next();
    }
  }

  /**
   * Set the current track in microseconds
   */
  set_position(track_id: string, position_msecond: number) {
    const metadata = this._get_metadata();

    const current_track_id = metadata["mpris:trackid"].get_string()[0];

    if (current_track_id !== track_id) {
      return;
    }

    this.player.seek(position_msecond / 1e6 * Gst.MSECOND);
  }

  /**
   * Open the URI given as an argument
   *
   * Not impremented
   */
  open_uri(_uri: string) {
    return;
  }

  /**
   * Indicate that the track position has changed.
   */
  _seeked(position: number) {
    // TODO: this doesn't work for some reason
    this._dbus_emit_signal(
      "Seeked",
      {
        Position: position,
      },
    );
  }

  /**
   * Gets all the metadata available for a set of tracks
   *
   * Not implemented
   */
  _get_tracks_metadata(_track_ids: string[]) {
    return [];
  }

  /**
   * Adds a URI in the TrackList. (MPRIS Method).
   *
   * Not implemented
   */
  _add_track(uri: string, after_track_id: string, set_as_current: boolean) {
    return;
  }

  /**
   * Removes an item from the TrackList.
   *
   * Not implemented
   */
  _remove_track(track_id: string) {
    return;
  }

  /**
   * Skip to the specified TrackId
   *
   * Not implemented
   */
  _go_to(path: string) {
    return;
  }

  _get<Property extends keyof ReturnType<typeof this._get_all>>(
    interface_name: GLib.Variant<"s">,
    property_name: GLib.Variant<"s">,
  ) {
    const iface = interface_name.get_string()[0];
    const prop = property_name.get_string()[0];

    try {
      return this._get_all(interface_name)?.[prop as Property];
    } catch (e) {
      const message = `MPRIS does not handle ${iface}.${prop}`;
      console.warn(message);
      throw new GLib.Error(GLib.LOG_DOMAIN, 0, message);
    }
  }

  _get_all(interface_name: GLib.Variant<"s">) {
    const iface = interface_name.get_string()[0];

    switch (iface) {
      case this.MEDIA_PLAYER2_IFACE:
        const application_id = this.app.get_application_id() ?? "";

        return {
          CanQuit: GLib.Variant.new_boolean(true),
          Fullscreen: GLib.Variant.new_boolean(false),
          CanSetFullscreen: GLib.Variant.new_boolean(false),
          CanRaise: GLib.Variant.new_boolean(true),
          HasTrackList: GLib.Variant.new_boolean(false),
          Identity: GLib.Variant.new_string("Muzika"),
          DesktopEntry: GLib.Variant.new_string(application_id),
          SupportedUriSchemes: GLib.Variant.new_strv([]),
          SupportedMimeTypes: GLib.Variant.new_strv([]),
        };
      case this.MEDIA_PLAYER2_PLAYER_IFACE:
        const position_msecond = Math.trunc(
          (this.player.get_normalised_position()) / 1e3,
        );
        const playback_status = this._get_playback_status();
        const is_shuffle = this.player.queue.shuffle;
        const can_play = this.player.queue.current != null;

        return {
          PlaybackStatus: GLib.Variant.new_string(playback_status),
          LoopStatus: GLib.Variant.new_string(this._get_loop_status()),
          Rate: GLib.Variant.new_double(1.0),
          Shuffle: GLib.Variant.new_boolean(is_shuffle),
          Metadata: GLib.Variant.new("a{sv}", this._get_metadata()),
          Position: GLib.Variant.new_int64(position_msecond),
          MinimumRate: GLib.Variant.new_double(1.0),
          MaximumRate: GLib.Variant.new_double(1.0),
          CanGoNext: GLib.Variant.new_boolean(this.player.queue.can_play_next),
          CanGoPrevious: GLib.Variant.new(
            "b",
            this.player.queue.can_play_previous,
          ),
          CanPlay: GLib.Variant.new_boolean(can_play),
          CanPause: GLib.Variant.new_boolean(can_play),
          CanSeek: GLib.Variant.new_boolean(true),
          CanControl: GLib.Variant.new_boolean(true),
        };
      case "org.freedesktop.DBus.Properties":
        return {};
      case "org.freedesktop.DBus.Introspectable":
        return {};
      default:
        console.warn(`MPRIS can not get, as it does not implement ${iface}`);
    }
  }

  _set(
    interface_name: GLib.Variant<"s">,
    property_name: GLib.Variant<"s">,
    new_value: GLib.Variant,
  ) {
    const iface = interface_name.get_string()[0];
    const prop = property_name.get_string()[0];

    switch (iface) {
      case this.MEDIA_PLAYER2_IFACE:
        if (prop === "Fullscreen") {
          return;
        }
        break;
      case this.MEDIA_PLAYER2_PLAYER_IFACE:
        switch (prop) {
          case "Rate":
          case "Volume":
            return;
          case "LoopStatus":
            switch (new_value.get_variant().get_string()[0]) {
              case "None":
                this.player.queue.repeat = RepeatMode.NONE;
                break;
              case "Track":
                this.player.queue.repeat = RepeatMode.ONE;
                break;
              case "Playlist":
                this.player.queue.repeat = RepeatMode.ALL;
                break;
            }
            break;
          case "Shuffle":
            if (new_value.get_variant().get_boolean()) {
              this.player.queue.shuffle = true;
            } else {
              this.player.queue.shuffle = false;
            }
        }
        break;
      default:
        console.warn(
          `MPRIS can not set, as it does not implement ${interface_name}`,
        );
    }
  }

  _properties_changed(
    interface_name: string,
    changed_properties: Record<string, GLib.Variant<any>>,
    invalidated_properties: string[],
  ) {
    this._dbus_emit_signal("PropertiesChanged", {
      "interface_name": interface_name,
      "changed_properties": changed_properties,
      "invalidated_properties": invalidated_properties,
    });
  }

  _introspect() {
    return MPRIS_XML;
  }
}

function hex_encode(string: string) {
  var hex, i;

  var result = "";
  for (i = 0; i < string.length; i++) {
    hex = string.charCodeAt(i).toString(16);
    result += ("000" + hex).slice(-4);
  }

  return result;
}
