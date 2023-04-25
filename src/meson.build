gnome = import('gnome')

sources = [
  'components/artist.ts',
  'components/artistheader.ts',
  'components/carousel.ts',
  'components/home.ts',
  'components/loading.ts',
  'components/playlist.ts',
  'components/playlistheader.ts',
  'components/search.ts',
  'components/webimage.ts',
  'polyfills/base64.ts',
  'polyfills/fetch.ts',
  'util/hash.ts',
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
  'org.example.TypescriptTemplate.src',
  'org.example.TypescriptTemplate.src.gresource.xml',
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
bin_conf.set('resource_path', '/org/example/TypescriptTemplate')

app_launcher = configure_file(
  input: 'org.example.TypescriptTemplate.in',
  output: 'org.example.TypescriptTemplate',
  configuration: bin_conf,
  install: true,
  install_dir: get_option('bindir')
)

run_target(
  'devel',
  command: [gjs_console, '-m', app_launcher],
  depends: [src_res, data_res, compile_local_schemas]
)