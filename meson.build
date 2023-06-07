project('muzika',
          version: '0.1.0',
    meson_version: '>= 0.62.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

i18n = import('i18n')
gnome = import('gnome')

pkgdatadir = join_paths(get_option('datadir'), meson.project_name())

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')

yarn = find_program('yarn', required: true)

yarn_args = ['--cwd', meson.project_source_root()]
yarnrc = get_option('yarnrc')

if yarnrc != ''
  yarn_args += [
    # note that this does not affect network requests, as it's getting them from
    # the offline mirror
    '--offline',
    '--use-yarnrc', yarnrc
  ]
endif

# print yarnrc to console
run_command(
  'echo',
  yarnrc,
  '\n\n\n\n',
  check: true,
)

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
