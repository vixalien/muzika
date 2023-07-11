import { AudioFormat, Format } from "src/muse";

interface Representation extends Record<string, any> {
  mimeType: string;
  codecs: string;
}

export function convert_formats_to_dash(media: Format[]) {
  const duration = get_presentation_duration(media);

  return `<?xml version="1.0"?>\n` + objectToSchema({
    "@name": "MPD",
    "xmlns": "urn:mpeg:dash:schema:mpd:2011",
    "profiles": "urn:mpeg:dash:profile:isoff-live:2011",
    "type": "static",
    "mediaPresentationDuration": duration,
    "minBufferTime": "PT2S",
    "suggestedPresentationDelay": "PT2S",
    // "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    // "xsi:schemaLocation": "urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd",
    "#children": [
      {
        "@name": "Period",
        "id": "period-0",
        "start": "PT0S",
        "duration": duration,
        // group by mimeType and codecs
        "#children": media.reduce((acc, format) => {
          const representation: Record<string, any> = {
            "@name": "Representation",
            "id": `video-${format.itag}`,
            "bandwidth": format.average_bitrate ?? format.bitrate,
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
          }

          if (format.has_audio) {
            representation.audioSamplingRate =
              (format as AudioFormat).sample_rate;
          }

          const definition = {
            "@name": "AdaptationSet",
            "mimeType": escape_attribute(format.mime_type.split(";")[0]),
            "codecs": escape_attribute(format.codecs),
            "segmentAlignment": "true",
            "bitstreamSwitching": "true",
            "#children": [representation],
          };

          const existing = acc.find((item) =>
            item.mimeType === definition.mimeType &&
            item.codecs === definition.codecs
          );

          if (existing) {
            existing["#children"].push(representation);
          } else {
            acc.push(definition);
          }

          return acc;
        }, [] as Representation[]),
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
