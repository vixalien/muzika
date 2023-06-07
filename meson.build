project('muzika',
          version: '0.1.0',
    meson_version: '>= 1.0.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

i18n = import('i18n')
gnome = import('gnome')

pkgdatadir = join_paths(get_option('datadir'), meson.project_name())

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')
yarn = find_program('yarn', required: true)

yarn_args = []

offline_mirror = get_option('offline-mirror')
if offline_mirror != ''
  run_command(
    'yarn',
    'config',
    '--offline',
    'set',
    'yarn-offline-mirror',
    offline_mirror,
    env: { 'HOME': meson.project_build_root() },
    check: true,
  )

  yarn_args += [
    '--offline',
    '--use-yarnrc', meson.project_build_root() / '.yarnrc'
  ]
endif

yarn_deps = custom_target(
  'yarn-deps',
  command: [ yarn, 'install', yarn_args ],
  output: ['yarn-deps-out']
)

subdir('data')
subdir('src')
subdir('po')

gnome.post_install(
     glib_compile_schemas: true,
    gtk_update_icon_cache: true,
  update_desktop_database: true,
)
