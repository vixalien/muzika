import GLib from "gi://GLib";

const encoder = new TextEncoder();

export function hash(string: string) {
  // use the subtle crypto API to generate a hash
  // return the hash as a hex string
  const hash = GLib.Checksum.new(GLib.ChecksumType.MD5);

  hash.update(string);

  const digest = encoder.encode(hash.get_string());

  return Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function get_cache_name(href: string) {
  const url = new URL(href);

  return hash(url.href);
}
