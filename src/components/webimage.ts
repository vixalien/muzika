import GdkPixbuf from "gi://GdkPixbuf";
import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import Adw from "gi://Adw";

/*
const IMAGE_URL = "https://cataas.com/cat";

Gio._promisify(Soup.Session.prototype, "send_async", "send_finish");
Gio._promisify(
  GdkPixbuf.Pixbuf,
  "new_from_stream_async",
  "new_from_stream_finish",
);

const input_stream = await getInputStream(IMAGE_URL);
const pixbuf = await GdkPixbuf.Pixbuf.new_from_stream_async(input_stream, null);
workbench.builder.get_object("picture").set_pixbuf(pixbuf);

async function getInputStream(url) {
  const session = new Soup.Session();
  const message = new Soup.Message({
    method: "GET",
    uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
  });
  const input_stream = await session.send_async(message, null, null);
  const { status_code, reason_phrase } = message;
  if (status_code !== 200) {
    throw new Error(`Got ${status_code}, ${reason_phrase}`);
  }
  return input_stream;
}

*/

import { fetch } from "../polyfills/fetch.js";
import { Thumbnail } from "libmuse";

export function get_square_thumbnails(thumbnails: Thumbnail[]) {
  const fixed: Thumbnail[] = [];

  for (const thumbnail of thumbnails) {
    // https://lh3.googleusercontent.com/a-/ACB-R5T582JMVfdC_ALzj8-zG02cm_YkhjRvJGbtSatWEg=w540-h225-l90-rj-dcjaKUJzkH
    // https://lh3.googleusercontent.com/a-/ACB-R5T582JMVfdC_ALzj8-zG02cm_YkhjRvJGbtSatWEg=w540-h225-l90-rj-gjdskfdsfk
    // https://lh3.googleusercontent.com/a-/ACB-R5T582JMVfdC_ALzj8-zG02cm_YkhjRvJGbtSatWEg=w540-h225-l90-rj
    const regex =
      /https:\/\/lh3.googleusercontent.com\/i-\S+=w(\d+)-h(\d+)-p-l90-rj-(?:\w+-)?(\w+)/;
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

export function load_thumbnails(
  image: Gtk.Image | Gtk.Picture | Adw.Avatar,
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
}

export function load_image(
  image: Gtk.Image | Gtk.Picture | Adw.Avatar,
  href: string,
  options: LoadOptions,
) {
  const url = new URL(href);

  fetch(url, {
    method: "GET",
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
  }).catch((e) => console.error(e.name, e.message));
}
