import GdkPixbuf from "gi://GdkPixbuf";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import Adw from "gi://Adw";

import { fetch } from "../polyfills/fetch.js";
import { Thumbnail } from "libmuse";

export function get_square_thumbnails(thumbnails: Thumbnail[]) {
  const fixed: Thumbnail[] = [];

  for (const thumbnail of thumbnails) {
    const regex =
      /https:\/\/lh3.googleusercontent.com\/\S+=w(\d+)-h(\d+)-p-l90-rj(-(\S+))?/;
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
  options: number | LoadOptions,
) {
  const required_size = typeof options === "number"
    ? options
    : options.width || options.height || 0;

  // choose the best thumbnail
  // by choosing the thumbnail with the smallest size that is larger than required_size

  let sorted_thumbnails = thumbnails.sort((a, b) => a.width - b.width);

  if (typeof options != "number" && options.square) {
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

  return best_thumbnail;
}

export function load_thumbnails(
  image: Gtk.Image | Gtk.Picture | Adw.Avatar,
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
}

export function load_image(
  image: Gtk.Image | Gtk.Picture | Adw.Avatar,
  href: string,
  options: LoadOptions,
) {
  const url = new URL(href);

  return fetch(url, {
    method: "GET",
    signal: options.signal,
  }).then(async (response) => {
    const buffer = await response.arrayBuffer();

    const loader = new GdkPixbuf.PixbufLoader();
    loader.write(new Uint8Array(buffer));
    loader.close();

    let pixbuf = loader.get_pixbuf()!;

    if (options.width && options.height) {
      pixbuf = pixbuf?.scale_simple(
        options.width,
        options.height,
        // crop
        GdkPixbuf.InterpType.HYPER,
      )!;
    }

    if (image instanceof Gtk.Picture) {
      image.set_pixbuf(pixbuf);
    } else if (image instanceof Gtk.Image) {
      image.set_from_pixbuf(pixbuf);
    } else if (image instanceof Adw.Avatar) {
      const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
      image.set_custom_image(texture);
    }
  }).catch((e) => {
    if (e.name !== "AbortError") {
      console.error("Couldn't load thumbnail:", e);
    }
  });
}
