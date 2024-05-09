import GLib from "gi://GLib";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function atob(string: string) {
  return decoder.decode(GLib.base64_decode(string));
}

export function btoa(string: string) {
  return GLib.base64_encode(encoder.encode(string));
}

globalThis.atob = atob;
globalThis.btoa = btoa;
