gnome = import('gnome')

sources = [
  'components/album/header.ts',
  'components/album/item.ts',
  'components/search/inlinecard.ts',
  'components/search/section.ts',
  'components/search/topresultcard.ts',
  'components/search/topresultsection.ts',
  'components/artistheader.ts',
  'components/inline-tab-switcher.ts',
  'components/carousel/albumcard.ts',
  'components/carousel/artistcard.ts',
  'components/carousel/flatsongcard.ts',
  'components/carousel/index.ts',
  'components/carousel/playlistcard.ts',
  'components/carousel/songcard.ts',
  'components/carousel/videocard.ts',
  'components/grid/index.ts',
  'components/loading.ts',
  'components/paginator.ts',
  'components/playlist/header.ts',
  'components/playlist/item.ts',
  'components/webimage.ts',
  'pages/library/index.ts',
  'pages/album.ts',
  'pages/artist.ts',
  'pages/error.ts',
  'pages/home.ts',
  'pages/playlist.ts',
  'pages/search.ts',
  'polyfills/abortcontroller.ts',
  'polyfills/base64.ts',
  'polyfills/customevent.ts',
  'polyfills/domexception.ts',
  'polyfills/fetch.ts',
  'util/hash.ts',
  'util/objectcontainer.ts',
  'endpoints.ts',
  'main.ts',
  'muse.ts',
  'navigation.ts',
  'window.ts',
]

outputs = []
foreach source : sources
  if '/' in source
    continue
  endif

	outputs += source.replace('.ts', '.js')
endforeach

typescript = custom_target(
  'typescript-compile',
  input: files(sources),
  build_by_default: true,
  build_always_stale: true,
  command: [ yarn, yarn_args, 'run', 'build', '--out', meson.project_build_root() / '@OUTDIR@', '--cwd', meson.project_build_root(), '@INPUT@','--src', meson.project_source_root() ],
  depends: yarn_deps,
  output: outputs,
)

src_res = gnome.compile_resources(
  'com.vixalien.muzika.src',
  'com.vixalien.muzika.src.gresource.xml',
  dependencies: typescript,
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

bin_conf = configuration_data()
bin_conf.set('GJS', gjs_console)
bin_conf.set('PACKAGE_VERSION', meson.project_version())
bin_conf.set('PACKAGE_NAME', meson.project_name())
bin_conf.set('prefix', get_option('prefix'))
bin_conf.set('libdir', join_paths(get_option('prefix'), get_option('libdir')))
bin_conf.set('datadir', join_paths(get_option('prefix'), get_option('datadir')))
bin_conf.set('resource_path', '/com/vixalien/muzika')

app_launcher = configure_file(
  input: 'com.vixalien.muzika.in',
  output: 'com.vixalien.muzika',
  configuration: bin_conf,
  install: true,
  install_dir: get_option('bindir')
)

run_target(
  'devel',
  command: [gjs_console, '-m', app_launcher],
  depends: [src_res, data_res, compile_local_schemas]
)