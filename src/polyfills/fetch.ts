import Soup from "gi://Soup?version=3.0";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

export function promiseTask(
  object: any,
  method: any,
  finish: any,
  ...args: any[]
) {
  return new Promise((resolve, reject) => {
    object[method](...args, (self: any, asyncResult: any) => {
      try {
        resolve(object[finish](asyncResult));
      } catch (err) {
        reject(err);
      }
    });
  });
}

export interface FetchOptions {
  body?: string | Uint8Array;
  url?: string;
  headers?: Record<string, string>;
  method?: string;
}

const encoder = new TextEncoder();

export async function fetch(url: string | URL, options: FetchOptions = {}) {
  if (typeof url !== "string" && ("href" in (url as URL))) {
    url = (url as URL).href;
  }

  const session = new Soup.Session();
  const method = options.method?.toUpperCase() || "GET";

  const uri = GLib.Uri.parse(url as string, GLib.UriFlags.NONE);

  const message = new Soup.Message({
    method,
    uri,
  });
  const headers = options.headers || {};

  const request_headers = message.get_request_headers();
  for (const header in headers) {
    request_headers.append(header, headers[header]);
  }

  if (typeof options.body === "string") {
    message.set_request_body_from_bytes(
      null,
      new GLib.Bytes(
        typeof options.body === "string"
          ? encoder.encode(options.body)
          : options.body,
      ),
    );
  }

  const inputStream = await promiseTask(
    session,
    "send_async",
    "send_finish",
    message,
    null,
    null,
  ) as Gio.InputStream;

  const { status_code, reason_phrase } = message;
  const ok = status_code >= 200 && status_code < 300;

  return {
    status: status_code,
    statusText: reason_phrase,
    ok,
    type: "basic",
    async json() {
      const text = await this.text();
      return JSON.parse(text);
    },
    async text() {
      const gBytes = await this.gBytes();
      return new TextDecoder().decode(gBytes.toArray());
    },
    async arrayBuffer() {
      const gBytes = await this.gBytes();
      return gBytes.toArray().buffer;
    },
    body() {
      return inputStream;
    },
    async gBytes() {
      const outputStream = Gio.MemoryOutputStream.new_resizable();

      await promiseTask(
        outputStream,
        "splice_async",
        "splice_finish",
        inputStream,
        Gio.OutputStreamSpliceFlags.CLOSE_TARGET |
          Gio.OutputStreamSpliceFlags.CLOSE_SOURCE,
        GLib.PRIORITY_DEFAULT,
        null,
      );

      const bytes = outputStream.steal_as_bytes();
      return bytes;
    },
  };
}

// @ts-ignore
window.fetch = fetch;
