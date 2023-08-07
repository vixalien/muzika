import Gio from "gi://Gio";

import { Song } from "src/muse";
import { languages } from "./languages";
import { format_has_video } from "src/player";

export function generate_subtitles_menu(song: Song) {
  if (!song.captions || song.captions.length === 0) return null;

  const menu = Gio.Menu.new();

  song.captions.forEach((caption, index) => {
    menu.append(
      caption.name || caption.lang,
      `player.set-subtitle-index(${index})`,
    );
  });

  const translable_caption = song.captions.find((caption) =>
    caption.translable
  );

  if (translable_caption) {
    const submenu = Gio.Menu.new();

    for (const lang of languages) {
      const url = new URL(translable_caption.url);
      url.searchParams.set("fmt", "vtt");
      url.searchParams.set("tlang", lang.code);

      submenu.append(lang.name, `player.set-subtitle-url("${lang.code}")`);
    }

    menu.append_submenu("Auto-translate", submenu);
  }

  return menu;
}

export function generate_video_menu(song: Song) {
  const all_video_formats = [...song.formats, ...song.adaptive_formats]
    .filter(format_has_video);

  if (all_video_formats.length === 0) return null;

  const qualities = VideoQualities
    .filter((quality) => {
      return all_video_formats.some((format) =>
        format.video_quality === quality.value
      );
    });

  const menu = Gio.Menu.new();

  menu.append(
    _("Auto"),
    `player.video-quality("auto")`,
  );

  qualities.forEach((quality) => {
    menu.append(
      quality.name,
      `player.video-quality("${quality.value}")`,
    );
  });

  return menu;
}

export function generate_song_menu(song: Song) {
  const menu = Gio.Menu.new();

  const subtitles_menu = generate_subtitles_menu(song);
  if (subtitles_menu) {
    menu.append_submenu(_("Subtitles"), subtitles_menu);
  }

  const video_menu = generate_video_menu(song);
  if (video_menu) {
    menu.append_submenu(_("Quality"), video_menu);
  }

  return menu;
}

const VideoQualities: { name: string; value: string }[] = [
  { name: "144p", value: "tiny" },
  { name: "240p", value: "small" },
  { name: "360p", value: "medium" },
  { name: "480p", value: "large" },
  { name: "720p", value: "hd720" },
  { name: "1080p (HD)", value: "hd1080" },
  { name: "1440p (HD)", value: "hd1440" },
  { name: "2160p (4K)", value: "hd2160" },
  { name: "High Resolution", value: "highres" },
];
