import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import Adw from "gi://Adw";

import { fetch } from "../polyfills/fetch.js";
import { Thumbnail } from "libmuse";
import { FixedRatioThumbnail } from "./fixed-ratio-thumbnail.js";

export function get_thumbnail_with_size(
  thumbnail: Thumbnail,
  required_width: number,
  required_height: number = required_width,
) {
  const regex =
    /https:\/\/lh3.googleusercontent.com\/\S+=w(\d+)-h(\d+)(-p)?-l90-rj(-(\S+))?/;
  const match = regex.exec(thumbnail.url);

  if (match) {
    const new_url = thumbnail.url.replace(
      /=w\d+-h\d+/,
      `=w${required_width}-h${required_height}`,
    );

    return {
      url: new_url,
      width: required_width,
      height: required_height,
    };
  } else {
    return thumbnail;
  }
}

export function get_square_thumbnails(thumbnails: Thumbnail[]) {
  const fixed: Thumbnail[] = [];

  for (const thumbnail of thumbnails) {
    const regex =
      /https:\/\/lh3.googleusercontent.com\/\S+=w(\d+)-h(\d+)-(\S+)/;
    const match = regex.exec(thumbnail.url);

    if (match) {
      const width = Number.parseInt(match[1]);
      const height = Number.parseInt(match[2]);

      if (width === height) {
        fixed.push(thumbnail);
      } else {
        const smallest = Math.min(width, height);
        const new_url = thumbnail.url.replace(
          /=w\d+-h\d+/,
          `=w${smallest}-h${smallest}`,
        );

        fixed.push({
          url: new_url,
          width: smallest,
          height: smallest,
        });
      }
    } else {
      fixed.push(thumbnail);
    }
  }

  return fixed;
}

export function get_best_thumbnail(
  thumbnails: Thumbnail[],
  _options: number | LoadOptions,
) {
  const options = typeof _options === "number" ? { width: _options } : _options;

  const required_size = options.width || options.height || 0;

  // choose the best thumbnail
  // by choosing the thumbnail with the smallest size that is larger than required_size

  let sorted_thumbnails = thumbnails.sort((a, b) => a.width - b.width);

  if (options.square) {
    sorted_thumbnails = get_square_thumbnails(sorted_thumbnails);
  }

  let best_thumbnail: Thumbnail | null = null;

  for (const thumbnail of sorted_thumbnails) {
    if (thumbnail.width >= required_size) {
      best_thumbnail = thumbnail;
      break;
    }
  }

  if (!best_thumbnail) {
    best_thumbnail = sorted_thumbnails[sorted_thumbnails.length - 1];
  }

  if (options.upscale && required_size > best_thumbnail.width) {
    best_thumbnail = get_thumbnail_with_size(
      best_thumbnail,
      options.width || options.height || 0,
      options.height || options.width || 0,
    );
  }

  return best_thumbnail;
}

export function load_thumbnails(
  image: Gtk.Image | Gtk.Picture | Adw.Avatar | FixedRatioThumbnail,
  thumbnails: Thumbnail[],
  options: number | LoadOptions,
) {
  const best_thumbnail = get_best_thumbnail(thumbnails, options);

  return load_image(
    image,
    best_thumbnail.url,
    typeof options !== "number" ? options : { width: options },
  );
}

export interface LoadOptions {
  width: number;
  height?: number;
  square?: boolean;
  signal?: AbortSignal;
  upscale?: boolean;
}

const thumbnails_map = new Map<string, Gdk.Texture>();

export function fetch_image(href: string, options: LoadOptions) {
  const cache_key = JSON.stringify({ href, options });

  if (thumbnails_map.has(cache_key)) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return Promise.resolve(thumbnails_map.get(cache_key)!);
  }

  const url = new URL(href);

  return fetch(url, {
    method: "GET",
    signal: options.signal,
  })
    .then(async (response) => {
      const buffer = await response.arrayBuffer();

      const texture = Gdk.Texture.new_from_bytes(new Uint8Array(buffer));

      if (options.width && options.height) {
        // pixbuf = pixbuf?.scale_simple(
        //   options.width,
        //   options.height,
        //   // crop
        //   GdkPixbuf.InterpType.HYPER,
        // )!;
      }

      thumbnails_map.set(cache_key, texture);

      return texture;
    })
    .catch((e) => {
      if (e.name !== "AbortError") {
        console.error("Couldn't load thumbnail:", e);
      }
      return null;
    });
}

export async function load_image(
  image: Gtk.Image | Gtk.Picture | Adw.Avatar | FixedRatioThumbnail,
  href: string,
  options: LoadOptions,
) {
  const texture = await fetch_image(href, options);

  if (texture) {
    if (image instanceof Gtk.Picture) {
      image.set_paintable(texture);
    } else if (image instanceof Gtk.Image) {
      image.set_from_paintable(texture);
    } else if (image instanceof Adw.Avatar) {
      image.set_custom_image(texture);
    } else if (image instanceof FixedRatioThumbnail) {
      image.paintable = texture;
    }
  }
}
