import Gio from "gi://Gio";
import GstPlay from "gi://GstPlay";

import type { Song } from "libmuse";

import { languages } from "./languages";
import { format_has_video, VideoQualities } from "src/player";

export function generate_subtitles_menu(
  song: Song,
  media_info: GstPlay.PlayMediaInfo,
) {
  const subtitles = media_info.get_subtitle_streams();

  if (!song.captions || song.captions.length === 0 || subtitles.length === 0) {
    return null;
  }

  const original_captions = subtitles.slice(0, song.captions.length);

  const translated_captions = subtitles.slice(song.captions.length);

  const menu = Gio.Menu.new();

  menu.append(_("Off"), "player.subtitle-index(-1)");

  original_captions.forEach((caption, index) => {
    // get better language names
    const code = caption.get_tags()?.get_string("language-code")[1];

    menu.append(
      code ? get_language_name(code) : caption.get_language(),
      `player.subtitle-index(${index})`,
    );
  });

  if (translated_captions.length > 0) {
    const submenu = Gio.Menu.new();

    translated_captions.forEach((caption, index) => {
      const adjusted_index = index + original_captions.length;

      submenu.append(
        languages[index]?.name ?? caption.get_language(),
        `player.subtitle-index(${adjusted_index})`,
      );
    });

    menu.append_submenu(_("Auto-translate"), submenu);
  }

  return menu;
}

export function generate_video_menu(song: Song) {
  const all_video_formats = [...song.formats, ...song.adaptive_formats].filter(
    format_has_video,
  );

  if (all_video_formats.length === 0) return null;

  const qualities = VideoQualities.filter((quality) => {
    return all_video_formats.some(
      (format) => format.video_quality === quality.value,
    );
  });

  const menu = Gio.Menu.new();

  menu.append(_("Auto"), `player.video-quality("auto")`);

  qualities.forEach((quality) => {
    menu.append(quality.name, `player.video-quality("${quality.value}")`);
  });

  return menu;
}

export function generate_song_menu(
  song: Song,
  media_info: GstPlay.PlayMediaInfo,
) {
  const menu = Gio.Menu.new();

  const section = Gio.Menu.new();

  const subtitles_menu = generate_subtitles_menu(song, media_info);
  if (subtitles_menu) {
    section.append_submenu(_("Subtitles"), subtitles_menu);
  }

  const video_menu = generate_video_menu(song);
  if (video_menu) {
    section.append_submenu(_("Quality"), video_menu);
  }

  menu.append_section(null, section);

  return menu;
}

function get_language_name(code: string) {
  const language = languages.find((lang) => lang.code === code);

  if (language) {
    return language.name;
  }

  return code;
}
