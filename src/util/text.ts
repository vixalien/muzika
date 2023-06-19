import { ArtistRun } from "../muse";

export function escape_label(label: string) {
  return label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function indent_stack(stack: string) {
  return escape_label(
    stack
      .split("\n")
      .map((line) => `    ${escape_label(line)}`)
      .join("\n"),
  );
}

export function pretty_subtitles(
  artists: (string | null | ArtistRun)[],
  text: (string | null)[] = [],
) {
  const author_markup: string[] = [];
  const author_plain: string[] = [];

  for (const node of artists) {
    if (typeof node === "string") {
      author_markup.push(escape_label(node));
      author_plain.push(escape_label(node));
    } else if (node) {
      author_markup.push(
        `<a href="muzika:artist:${node.id}">${escape_label(node.name)}</a>`,
      );
      author_plain.push(escape_label(node.name));
    }
  }

  const merge = (authors: string[]) => {
    return [authors.join(", "), text.join(" • ")]
      .filter(Boolean)
      .join(" • ");
  };

  return { markup: merge(author_markup), plain: merge(author_plain) };
}
