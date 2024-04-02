gnome = import('gnome')

yarn_args = ['--cwd', meson.project_source_root()]
yarnrc = get_option('yarnrc')

if yarnrc != ''
  yarn_args += ['--offline', '--use-yarnrc', yarnrc]
endif

yarn_deps = custom_target(
  'yarn-deps',
  command: [ yarn, yarn_args, 'install' ],
  output: ['node_modules']
)

typescript = custom_target(
  'typescript-compile',
  input: ['main.ts'],
  build_by_default: true,
  build_always_stale: true,
  command: [ yarn, yarn_args, 'run', 'build', '--out', meson.project_build_root() / '@OUTDIR@', '--cwd', meson.project_build_root(), '@INPUT@' ],
  depends: yarn_deps,
  output: ['main.js'],
)

src_res = gnome.compile_resources(
  application_id + '.src',
  '@0@.src.gresource.xml'.format(base_name),
  dependencies: typescript,
  gresource_bundle: true,
  install: true,
  install_dir: muzika_pkgdatadir,
)

bin_conf = configuration_data()
bin_conf.set('GJS', gjs_console)
bin_conf.set('PACKAGE_VERSION', '@0@@1@'.format(meson.project_version(), version_suffix))
bin_conf.set('APPLICATION_ID', application_id)
bin_conf.set('prefix', muzika_prefix)
bin_conf.set('libdir', muzika_libdir)
bin_conf.set('datadir', muzika_datadir)
bin_conf.set('resource_path', '/com/vixalien/muzika')
bin_conf.set('profile', profile)

app_launcher = configure_file(
  input: '@0@.in'.format(base_name),
  output: application_id,
  configuration: bin_conf,
  install: true,
  install_dir: muzika_bindir
)

run_target(
  'devel',
  command: [gjs_console, '-m', app_launcher],
  depends: [src_res, data_res, compile_local_schemas]
)
