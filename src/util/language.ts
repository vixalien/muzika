import Pango from "gi://Pango";

import { set_option } from "libmuse";
import locales from "libmuse/locales/locales";

function get_muse_lang(language: string) {
  for (const lang of locales.languages) {
    if (lang.value.toLowerCase() === language.toLowerCase()) return lang;
  }

  // do a second pass to get match "en" instead of "en-US" and similar
  for (const lang of locales.languages) {
    if (lang.value.toLowerCase() === language.toLowerCase().split("-")[0]) {
      return lang;
    }
  }

  return null;
}

export function get_default_muse_lang() {
  const default_lang = get_muse_lang(Pango.Language.get_default().to_string());

  if (default_lang) return default_lang;

  for (const language of Pango.Language.get_preferred() || []) {
    const muse_lang = get_muse_lang(language.to_string());

    if (muse_lang) return muse_lang;
  }

  return null;
}

export function set_muse_lang() {
  const lang = get_default_muse_lang();

  if (lang) {
    set_option("language", lang.value);
  }
}

export function get_language_string(value: string) {
  const lang = locales.languages.find((lang) => {
    return lang.value === value;
  });

  if (lang) {
    return `${lang.name} - ${lang.value}`;
  }

  return _("Invalid language selected");
}
