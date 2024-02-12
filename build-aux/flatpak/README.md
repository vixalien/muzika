# Flatpak Builds

This directory contains the Flatpak Manifest and other modules required for
building a Muzika Flatpak.

## Modules

### blueprint-compiler

This module is responsible for transforming our UI files from the blueprint
format (`.blp`) to the Builder XML format (`.xml`). The .xml files are the ones
we package because they are the only ones compatible with GTK natively.

### gst-plugin-gtk4

This is part of the
[gstreamer-rs](https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs) project,
which are additional Gstreamer "plugin"s written in Rust. They are
[slated for inclusion]() in the official Gstreamer package, which will make them
part of the [org.gnome.Sdk]() anytime soon.

For now though, we must build the plugin manually, as it is the one that
provides `Gtk4PaintableSink`, which is what we use to display videos.

To update the relevant `gtk4-plugin-gtk4-sources.json` file, do:

```sh
wget https://crates.io/api/v1/crates/gst-plugin-gtk4/0.11.1/download
tar -xf download
cd gst-plugin-gtk4-0.11.1/
flatpak-cargo-generator Cargo.lock -o ../modules/gst-plugin-gtk4-sources.json
```

### yarn-deps

These are JavaScript NPM modules that are used in the project. They are listed
in the `package.json` at the root, and wrote into the lockfile `yarn.lock` by
`yarn install`. We then convert the yarn.lock into a format the flatpak builder
can understand using the following command that creates `yarn-deps-sources.json`

```sh
yarn run generate-sources
```
