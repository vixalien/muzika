import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Adw from "gi://Adw";

import type { LikeStatus, QueueTrack } from "libmuse";

import { get_player } from "src/application";
import { MuzikaPlayer } from "src/player";
import { escape_label, pretty_subtitles } from "src/util/text";
import { SignalListeners } from "src/util/signal-listener";
import { load_thumbnails } from "src/components/webimage";
import { micro_to_string } from "src/util/time";
import { FixedRatioThumbnail } from "src/components/fixed-ratio-thumbnail";
import { bind_play_icon, bind_repeat_button } from "src/player/helpers";
import { list_model_to_array } from "src/util/list";
import { get_button_props } from "src/util/menu/like";

export class PlayerNowPlayingView extends Adw.NavigationPage {
  static {
    GObject.registerClass(
      {
        GTypeName: "PlayerNowPlayingView",
        Template:
          "resource:///com/vixalien/muzika/ui/components/player/now-playing/view.ui",
        InternalChildren: [
          "video_counterpart",
          "music_counterpart",
          "title",
          "subtitle",
          "picture",
          "timestamp",
          "duration",
          "play_image",
          "overlay_box",
          "repeat_button",
          "expand_button",
          "fullscreen_button",
          "switchers",
          "like_button",
          "dislike_button",
        ],
        Properties: {
          switcher_stack: GObject.param_spec_object(
            "switcher-stack",
            "Switcher Stack",
            "The Stack associated with the switcher",
            Adw.ViewStack.$gtype,
            GObject.ParamFlags.READWRITE,
          ),
          switcher_visible: GObject.param_spec_boolean(
            "switcher-visible",
            "Switcher Visible",
            "Whether to show the switcher stack",
            false,
            GObject.ParamFlags.READWRITE,
          ),
        },
        Signals: {
          "bottom-bar-clicked": {},
        },
      },
      this,
    );
  }

  player: MuzikaPlayer;

  private _video_counterpart!: Gtk.ToggleButton;
  private _music_counterpart!: Gtk.ToggleButton;
  private _title!: Gtk.Label;
  private _subtitle!: Gtk.Label;
  private _picture!: FixedRatioThumbnail;
  private _timestamp!: Gtk.Label;
  private _duration!: Gtk.Label;
  private _play_image!: Gtk.Image;
  private _overlay_box!: Gtk.Box;
  private _repeat_button!: Gtk.ToggleButton;
  private _expand_button!: Gtk.Button;
  private _fullscreen_button!: Gtk.Button;
  private _switchers!: Gtk.Box;
  private _like_button!: Gtk.ToggleButton;
  private _dislike_button!: Gtk.ToggleButton;

  private construct_switcher(
    stack: Adw.ViewStack,
    i: number,
    page: Adw.ViewStackPage,
  ) {
    const label = new Gtk.Label({
      label: page.title,
      css_classes: ["caption-heading"],
    });

    const icon = new Gtk.Image({
      icon_name: page.icon_name,
    });

    const container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      css_classes: ["switcher-button"],
    });

    container.append(icon);
    container.append(label);

    const button = new Gtk.Button({ child: container, css_classes: ["flat"] });

    page.bind_property(
      "visible",
      button,
      "visible",
      GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
    );

    button.connect("clicked", () => {
      stack.pages.select_item(i, true);
      this.emit("bottom-bar-clicked");
    });

    return button;
  }

  private render_switchers(stack: Adw.ViewStack) {
    let child = this._switchers.get_first_child();

    while (child != null) {
      const old_child = child;
      child = child.get_next_sibling();
      old_child.unparent();
    }

    (list_model_to_array(stack.pages) as Adw.ViewStackPage[]).forEach(
      (page, i) => {
        this._switchers.append(this.construct_switcher(stack, i, page));
      },
    );
  }

  private _switcher_stack: Adw.ViewStack | null = null;

  get switcher_stack() {
    return this._switcher_stack;
  }

  set switcher_stack(stack: Adw.ViewStack | null) {
    if (stack == null || stack === this._switcher_stack) return;

    // connect switcher stack handler
    this._switcher_stack = stack;
    this.render_switchers(stack);

    this.notify("switcher-stack");
  }

  get switcher_visible() {
    return this._switchers.visible;
  }

  set switcher_visible(visible: boolean) {
    this._switchers.visible = visible;
  }

  constructor() {
    super();

    this.player = get_player();
  }

  private activate_link_cb(_: Gtk.Label, uri: string) {
    if (uri && uri.startsWith("muzika:")) {
      this.activate_action("navigator.visit", GLib.Variant.new_string(uri));

      return true;
    }
  }

  private listeners = new SignalListeners();

  setup_player() {
    this.song_changed();

    // update the player when the current song changes
    this.listeners.connect(
      this.player.queue,
      "notify::current",
      this.song_changed.bind(this),
    );

    this.listeners.add_bindings(
      // @ts-expect-error incorrect types
      this.player.bind_property_full(
        "duration",
        this._duration,
        "label",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, micro_to_string(this.player.duration)];
        },
        null,
      ),
      // @ts-expect-error incorrect types
      this.player.bind_property_full(
        "timestamp",
        this._timestamp,
        "label",
        GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE,
        () => {
          return [true, micro_to_string(this.player.timestamp)];
        },
        null,
      ),
      bind_play_icon(this._play_image),
      ...bind_repeat_button(this._repeat_button),
    );
  }

  song_changed() {
    // this.scale.value = this.player.timestamp;

    // this._progress_label.label = micro_to_string(this.player.timestamp);

    const song = this.player.queue.current?.object;

    if (song) {
      this.show_song(song);
      this.update_thumbnail();
    }
  }

  private _pending_animation: Adw.Animation | null = null;

  private animate_aspect_ratio() {
    if (this._pending_animation) {
      this._pending_animation.skip();
    }

    const current_ratio = this._picture.aspect_ratio;
    const new_ratio = this.player.queue.current_is_video ? 1.5 : 1;

    if (new_ratio == current_ratio) return;

    this._pending_animation = Adw.TimedAnimation.new(
      this._picture,
      current_ratio,
      new_ratio,
      400,
      Adw.PropertyAnimationTarget.new(this._picture, "aspect-ratio"),
    );

    this._pending_animation.connect("done", () => {
      this._pending_animation = null;
    });

    this._pending_animation.play();
  }

  show_song(track: QueueTrack) {
    // thumbnail

    this._video_counterpart.sensitive = this._music_counterpart.sensitive =
      !!track.counterpart;

    this._overlay_box.visible = this.player.queue.current_is_video;

    if (this.player.queue.current_is_video) {
      this._video_counterpart.active = true;
    } else {
      this._music_counterpart.active = true;
    }

    this.animate_aspect_ratio();

    // labels

    if (track.album) {
      this._title.set_markup(
        `<a href="muzika:album:${track.album.id}?track=${track.videoId}">${escape_label(
          track.title,
        )}</a>`,
      );
      this._title.tooltip_text = track.title;
    } else {
      this._title.use_markup = false;
      this._title.label = track.title;
      this._title.tooltip_text = track.title;
    }

    const subtitle = pretty_subtitles(track.artists);

    this._subtitle.set_markup(subtitle.markup);
    this._subtitle.tooltip_text = subtitle.plain;

    this.update_like_buttons();

    // this._duration_label.label = track.duration_seconds
    //   ? seconds_to_string(track.duration_seconds)
    //   : track.duration ?? "00:00";
  }

  /**
   * loading multiple thumbnails can result in the previous one loading
   * after the current one, so we need to abort the previous one
   */
  abort_thumbnail: AbortController | null = null;

  update_thumbnail() {
    const player = get_player();

    const song = player.queue.current?.object;

    if (!song) return;

    if (this.abort_thumbnail != null) {
      this.abort_thumbnail.abort();
      this.abort_thumbnail = null;
    }

    if (player.queue.current_is_video) {
      this._picture.paintable = this.player.paintable;
    } else {
      this.abort_thumbnail = new AbortController();

      const theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!);
      const icon = theme.lookup_icon(
        "image-missing-symbolic",
        [],
        400,
        this.scale_factor,
        this.get_direction(),
        Gtk.IconLookupFlags.FORCE_SYMBOLIC,
      );

      this._picture.paintable = icon;

      load_thumbnails(this._picture, song.thumbnails, {
        width: 400,
        signal: this.abort_thumbnail.signal,
        upscale: true,
      });
    }
  }

  private switch_counterpart() {
    this.player.queue.switch_counterpart();
  }

  vfunc_map(): void {
    this.listeners.clear();
    this.setup_player();
    super.vfunc_map();
  }

  vfunc_unmap(): void {
    this.listeners.clear();
    super.vfunc_unmap();
  }

  private show_fullscreen_button() {
    this._fullscreen_button.visible = true;
    this._expand_button.visible = true;
  }

  private hide_fullscreen_button() {
    this._fullscreen_button.visible = false;
    this._expand_button.visible = false;
  }

  private toggle_fullscreen_button() {
    // wait to hide the button so that it can be clicked
    // see https://github.com/vixalien/muzika/issues/74
    if (this._fullscreen_button.visible === false) {
      this.show_fullscreen_button();
    } else {
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
        this.hide_fullscreen_button();
        return GLib.SOURCE_REMOVE;
      });
    }
  }

  private updating_like_buttons = false;

  private update_like_buttons() {
    const song = this.player.queue.current?.object;
    if (!song) return;

    this.updating_like_buttons = true;

    if (song.likeStatus) {
      this._like_button.sensitive = this._dislike_button.sensitive = true;

      const props = get_button_props(song.likeStatus || "INDIFFERENT");

      Object.assign(this._like_button, props.like);
      Object.assign(this._dislike_button, props.dislike);
    } else {
      this._like_button.sensitive = this._dislike_button.sensitive = false;
    }

    this.updating_like_buttons = false;
  }

  private like_button_toggled(
    like = true,
    cb?: (newStatus: LikeStatus) => void,
  ) {
    const song = this.player.queue.current?.object;
    if (!song || this.updating_like_buttons) return;

    let newStatus: LikeStatus;

    if (like) {
      newStatus = song.likeStatus === "LIKE" ? "INDIFFERENT" : "LIKE";
    } else {
      newStatus = song.likeStatus === "DISLIKE" ? "INDIFFERENT" : "DISLIKE";
    }

    if (newStatus === song.likeStatus) return;

    this.activate_action(
      "win.rate-song",
      GLib.Variant.new("(sss)", [
        song.videoId,
        newStatus,
        song.likeStatus ?? "",
      ]),
    );

    song.likeStatus = newStatus;

    this.update_like_buttons();

    cb?.(newStatus);
  }

  private like_cb() {
    this.like_button_toggled();
  }

  private dislike_cb() {
    this.like_button_toggled(false, (status) => {
      if (status === "DISLIKE") {
        this.player.queue.next();
      }
    });
  }
}
