# Flatpak Builds

This directory contains the Flatpak Manifest and other modules required for
building a Muzika Flatpak.

## Modules

### blueprint-compiler

This module is responsible for transforming our UI files from the blueprint
format (`.blp`) to the Builder XML format (`.xml`). The .xml files are the ones
we package because they are the only ones compatible with GTK natively.

### yarn-deps

These are JavaScript NPM modules that are used in the project. They are listed
in the `package.json` at the root, and wrote into the lockfile `yarn.lock` by
`yarn install`. We then convert the yarn.lock into a format the flatpak builder
can understand using the following command that creates `yarn-deps-sources.json`

```sh
yarn run generate-sources
```
