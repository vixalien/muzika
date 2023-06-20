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

export interface PrettySubtitleOptions {
  prefix?: string | (string | null)[];
  suffix?: string | (string | null)[];
}

function normalize_nodes(nodes?: string | (string | null)[]): string[] {
  if (nodes === undefined) {
    return [];
  } else if (typeof nodes === "string") {
    return [nodes];
  } else {
    return nodes
      .filter((node) => node != null) as string[];
  }
}

export function pretty_subtitles(
  artists: (string | null | ArtistRun)[],
  options: (string | null)[] | PrettySubtitleOptions = [],
) {
  const { prefix, suffix = [] } = Array.isArray(options)
    ? { suffix: normalize_nodes(options), prefix: [] }
    : {
      prefix: normalize_nodes(options.prefix),
      suffix: normalize_nodes(options.suffix),
    };

  const author_markup: string[] = [];
  const author_plain: string[] = [];

  for (const node of artists) {
    if (is_artist_run(node)) {
      if (node.id) {
        author_markup.push(
          `<a href="muzika:artist:${node.id}">${escape_label(node.name)}</a>`,
        );
      } else {
        author_markup.push(escape_label(node.name));
      }
      author_plain.push(escape_label(node.name));
    } else if (typeof node === "string") {
      author_markup.push(escape_label(node));
      author_plain.push(escape_label(node));
    }
  }

  const merge = (authors: string[]) => {
    return [
      prefix.map(escape_label).join(" • "),
      authors.join(", "),
      suffix.map(escape_label).join(" • "),
    ]
      .filter(Boolean)
      .join(" • ");
  };

  return { markup: merge(author_markup), plain: merge(author_plain) };
}

function is_artist_run(node: any): node is ArtistRun {
  return node && typeof node === "object" && "name" in node;
}
