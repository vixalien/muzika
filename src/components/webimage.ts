import GdkPixbuf from "gi://GdkPixbuf";
import Gtk from "gi://Gtk?version=4.0";

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

export function load_thumbnails(
  image: Gtk.Image | Gtk.Picture,
  thumbnails: Thumbnail[],
  options: number | LoadOptions,
) {
  const required_size = typeof options === "number"
    ? options
    : options.width || options.height || 0;

  // choose the best thumbnail
  // by choosing the thumbnail with the smallest size that is larger than required_size

  const sorted_thumbnails = thumbnails.sort((a, b) => a.width - b.width);

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
    typeof options !== "number" ? options : {},
  );
}

export interface LoadOptions {
  width?: number;
  height?: number;
}

export function load_image(
  image: Gtk.Image | Gtk.Picture,
  href: string,
  options: LoadOptions = {},
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
    } else {
      image.set_from_pixbuf(pixbuf);
    }
  }).catch((e) => console.error(e.name, e.message));
}
