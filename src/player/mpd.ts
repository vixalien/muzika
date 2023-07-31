import { AudioFormat, Format, Song, VideoFormat } from "src/muse";

export function convert_formats_to_dash(song: Song) {
  const duration = get_presentation_duration(song.formats);

  const video_formats = song.formats.filter((format) =>
    format.has_video
  ) as VideoFormat[];
  const audio_formats = song.formats.filter((format) =>
    format.has_audio
  ) as AudioFormat[];

  const get_max = (key: keyof VideoFormat) =>
    video_formats
      .reduce((acc: any, format) => {
        if (format[key] as number > acc) {
          return format[key];
        }
        return acc;
      }, 0);

  const max_width = get_max("width");
  const max_height = get_max("height");
  const max_fps = get_max("fps");

  return `<?xml version="1.0"?>\n` + objectToSchema({
    "@name": "MPD",
    "xmlns": "urn:mpeg:dash:schema:mpd:2011",
    "profiles": "urn:mpeg:dash:profile:isoff-on-demand:2011",
    "type": "static",
    "mediaPresentationDuration": duration,
    "minBufferTime": "PT2S",
    // "suggestedPresentationDelay": "PT2S",
    // "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    // "xsi:schemaLocation": "urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd",
    "#children": [
      {
        "@name": "ProgramInformation",
        "moreInformationURL": "https://github.com/vixalien/muzika",
        "#children": "Dashed Song",
      },
      {
        "@name": "Period",
        "duration": duration,
        "#children": [
          ...song.formats.reduce((acc, format, index) => {
            if (format.has_audio && format.has_video) return acc;

            const representation: Record<string, any> = {
              "@name": "Representation",
              "id": `format-${format.itag}`,
              "mimeType": escape_attribute(format.mime_type.split(";")[0]),
              "codecs": escape_attribute(format.codecs.split(",")[0]),
              "bandwidth": format.average_bitrate || format.bitrate,
              "#children": [
                {
                  "@name": "BaseURL",
                  "@noindent": true,
                  "#children": getInitializationUrl(format),
                },
                ...(
                  format.index_range
                    ? [
                      {
                        "@name": "SegmentBase",
                        "indexRangeExact": "true",
                        "indexRange":
                          `${format.index_range.start}-${format.index_range.end}`,
                        "#children": [
                          ...(
                            format.init_range
                              ? [
                                {
                                  "@name": "Initialization",
                                  "range":
                                    `${format.init_range.start}-${format.init_range.end}`,
                                },
                              ]
                              : []
                          ),
                        ],
                      },
                    ]
                    : []
                ),
              ],
            };

            if (format.has_video) {
              representation.width = format.width;
              representation.height = format.height;
              representation.frameRate = format.fps;
              representation.par = get_ratio(format.width, format.height);
              representation.sar = "1:1";
              representation.startWithSAP = "1";
            }

            if (format.has_audio) {
              representation.audioSamplingRate =
                (format as AudioFormat).sample_rate;
            }

            const definition: Record<string, any> = {
              "@name": "AdaptationSet",
              "group": index,
              "bitstreamSwitching": "true",
              "segmentAlignment": "true",
              "subsegmentStartsWithSAP": "1",
              "#children": [representation],
            };

            if (format.has_video) {
              definition.maxWidth = max_width;
              definition.maxHeight = max_height;
              definition.maxFrameRate = max_fps;
            }

            if (format.has_audio) {
              definition.lang = "en";
            }

            const existing = acc.find((item) => {
              const first_representation = item["#children"][0];

              if (!first_representation) return false;

              return (
                first_representation.mimeType === representation.mimeType &&
                first_representation.codecs.split(".")[0] ===
                  representation.codecs.split(".")[0]
              );
            });

            if (existing) {
              existing["#children"].push(representation);
            } else {
              acc.push(definition);
            }

            return acc;
          }, [] as Record<string, any>[]),
          // see https://gitlab.freedesktop.org/gstreamer/gstreamer/-/issues/2872
          ...song.captions.map((caption, index) => {
            const url = new URL(caption.url);
            url.searchParams.set("fmt", "vtt");

            return {
              "@name": "AdaptationSet",
              "lang": caption.lang,
              "mimeType": "text/vtt",
              "#children": [
                {
                  "@name": "Representation",
                  "id": `caption-${index}`,
                  "bandwidth": 256,
                  "#children": [
                    {
                      "@name": "BaseURL",
                      "@noindent": true,
                      "#children": escape_uri(url.toString()),
                    },
                  ],
                },
              ],
            };
          }),
        ],
      },
    ],
  });
}

function get_presentation_duration(media: Format[]) {
  let maxDuration = 0;
  for (const format of media) {
    if (format.duration_ms > maxDuration) {
      maxDuration = format.duration_ms;
    }
  }
  return `PT${maxDuration / 1000}S`;
}

function escape_attribute(str: string) {
  return str
    .replace(/\"/g, '\\"')
    .replace(/\'/g, "\\'");
}

function escape_uri(uri: string) {
  return uri
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getInitializationUrl(format: Format) {
  return escape_uri(format.url);
}

function indent(str: string) {
  return str
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function objectToSchema(obj: any) {
  const attributes: Record<string, any> = {};

  const noindent = Object.hasOwn(obj, "@noindent");

  let body = "";

  for (const key in obj) {
    const value = obj[key];

    if (key.startsWith("@")) continue;

    if (key === "#children") {
      if (Array.isArray(value)) {
        body += value
          .map((child) => indent(objectToSchema(child)))
          .join("\n");
      } else {
        body += (noindent ? "" : "  ") + value.toString();
      }
      continue;
    }

    attributes[key] = value;
  }

  const attributes_string = Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");

  const body_text = noindent ? body : `
${body}
`;

  const closing = body ? `>${body_text}</${obj["@name"]}>` : "/>";

  return `<${obj["@name"]}${
    attributes_string ? " " + attributes_string : ""
  }${closing}`;
}

function get_ratio(a: number, b: number) {
  for (let base = b; base > 1; base--) {
    if ((a % base) == 0 && (b % base) == 0) {
      a = a / base;
      b = b / base;
    }
  }

  return a + ":" + b;
}
