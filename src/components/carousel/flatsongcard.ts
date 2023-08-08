import Gtk from "gi://Gtk?version=4.0";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { ArtistRun, FlatSong, PlaylistItem, Thumbnail } from "../../muse.js";
import { DynamicImage, DynamicImageState } from "../dynamic-image.js";

// first register the DynamicImage class
import "../dynamic-image.js";
import { pretty_subtitles } from "src/util/text.js";
import { load_thumbnails } from "../webimage.js";
import {
  ParsedSong,
  ParsedVideo,
  Ranked,
} from "libmuse/types/parsers/browsing.js";

export type InlineSong =
  | FlatSong
  | Ranked<ParsedSong>
  | Ranked<ParsedVideo>
  | PlaylistItem;

export class FlatSongCard extends Gtk.Box {
  static {
    GObject.registerClass({
      GTypeName: "FlatSongCard",
      Template:
        "resource:///com/vixalien/muzika/ui/components/carousel/flatsong.ui",
      InternalChildren: [
        "title",
        "explicit",
        "subtitle",
        "dynamic_image",
      ],
    }, this);
  }

  song?: InlineSong;

  private _title!: Gtk.Label;
  private _explicit!: Gtk.Image;
  private _subtitle!: Gtk.Label;
  private _dynamic_image!: DynamicImage;

  constructor() {
    super();

    this._subtitle.connect("activate-link", (_, uri) => {
      if (uri && uri.startsWith("muzika:")) {
        this.activate_action(
          "navigator.visit",
          GLib.Variant.new_string(uri),
        );

        return true;
      }
    });
  }

  // utils

  private load_thumbnails(
    thumbnails: Thumbnail[],
    options: Parameters<typeof load_thumbnails>[2] = 60,
  ) {
    this._dynamic_image.load_thumbnails(thumbnails, options);
  }

  private set_title(title: string) {
    this._title.tooltip_text = this._title.label = title;
  }

  private subtitle_authors: (string | ArtistRun)[] = [];
  private subtitle_nodes: string[] = [];

  private update_subtitle() {
    const subtitles = pretty_subtitles(
      this.subtitle_authors,
      this.subtitle_nodes,
    );

    this._subtitle.label = subtitles.markup;
    this._subtitle.tooltip_text = subtitles.plain;
  }

  private set_subtitle(
    subtitle: string | (null | string | ArtistRun)[],
    nodes: (string | null)[] = [],
  ) {
    this.subtitle_authors = [];
    this.subtitle_nodes = nodes.filter(Boolean) as string[];

    if (typeof subtitle === "string") {
      this.subtitle_authors.push(subtitle);
    } else {
      for (const node of subtitle) {
        if (!node) continue;

        this.subtitle_authors.push(node);
      }
    }

    this.update_subtitle();
  }

  private setup_video(videoId: string | null) {
    if (videoId) {
      this._dynamic_image.setup_video(videoId);
    }
  }

  private show_explicit(explicit: boolean) {
    this._explicit.visible = explicit;
  }

  show_flat_song(song: FlatSong) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(song.artists ?? [], [song.views]);
    this.show_explicit(song.isExplicit);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);
  }

  show_song(song: Ranked<ParsedSong>) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(song.artists ?? [], [song.views]);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);
  }

  show_video(song: Ranked<ParsedVideo>) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(song.artists ?? [], [song.views]);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);
  }

  show_playlist_item(song: PlaylistItem) {
    this.song = song;

    this.set_title(song.title);
    this.set_subtitle(song.artists ?? []);

    this.load_thumbnails(song.thumbnails);
    this.setup_video(song.videoId);
  }

  show_item(content: InlineSong) {
    if (is_playlist_item(content)) {
      this.show_playlist_item(content);
      return;
    }

    switch (content.type) {
      case "flat-song":
        this.show_flat_song(content);
        break;
      case "inline-video":
      case "song":
        this.show_song(content);
        break;
      case "video":
        this.show_video(content);
        break;
      default:
        console.warn(`Unknown content type: ${(content as any).type}`);
    }
  }

  set_state(state: DynamicImageState) {
    this._dynamic_image.state = state;
  }
}

export function is_playlist_item(song: InlineSong): song is PlaylistItem {
  return Object.hasOwn(song, "isAvailable") &&
    Object.hasOwn(song, "setVideoId");
}
