project('muzika',
          version: 'nightly',
    meson_version: '>= 0.62.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

if get_option('profile') == 'development'
  profile = '.Devel'
  name_suffix = ' (Development)'
  vcs_tag = run_command('git', 'rev-parse', '--short', 'HEAD', check: true).stdout().strip()
  if vcs_tag == ''
    version_suffix = '-devel'
  else
    version_suffix = '-@0@'.format (vcs_tag)
  endif
else
  profile = ''
  name_suffix = ''
  version_suffix = ''
endif


base_name = 'com.vixalien.muzika'
application_id = '@0@@1@'.format(base_name, profile)

i18n = import('i18n')
gnome = import('gnome')

gettext_package = application_id
muzika_prefix = get_option('prefix')
muzika_bindir = muzika_prefix / get_option('bindir')
muzika_libdir = muzika_prefix / get_option('libdir')
muzika_datadir = muzika_prefix / get_option('datadir')
muzika_pkgdatadir = muzika_datadir / application_id
muzika_schemadir = muzika_datadir / 'glib-2.0' / 'schemas'

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')
yarn = find_program('yarn', required: true)

subdir('data')
subdir('src')
subdir('po')

gnome.post_install(
     glib_compile_schemas: true,
    gtk_update_icon_cache: true,
  update_desktop_database: true,
)
