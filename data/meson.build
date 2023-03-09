desktop_file = i18n.merge_file(
        input: 'org.example.TypescriptTemplate.desktop.in',
       output: 'org.example.TypescriptTemplate.desktop',
         type: 'desktop',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'applications')
)

desktop_utils = find_program('desktop-file-validate', required: false)
if desktop_utils.found()
  test('Validate desktop file', desktop_utils, args: [desktop_file])
endif

appstream_file = i18n.merge_file(
        input: 'org.example.TypescriptTemplate.appdata.xml.in',
       output: 'org.example.TypescriptTemplate.appdata.xml',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'appdata')
)

appstream_util = find_program('appstream-util', required: false)
if appstream_util.found()
  test('Validate appstream file', appstream_util, args: ['validate', appstream_file])
endif

gsettings_schema = 'org.example.TypescriptTemplate.gschema.xml'

local_schemas = configure_file(
  copy: true,
  input: gsettings_schema,
  output: gsettings_schema
)

install_data(gsettings_schema,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0/schemas')
)

compile_schemas = find_program('glib-compile-schemas', required: false)

compile_local_schemas = custom_target(
  'compile_local_schemas',
  input: local_schemas,
  output: 'gschemas.compiled',
  command: [compile_schemas, meson.current_build_dir()]
)

if compile_schemas.found()
  test('Validate schema file',
       compile_schemas,
       args: ['--strict', '--dry-run', meson.current_source_dir()])
endif

data_res = gnome.compile_resources(
  'org.example.TypescriptTemplate.data',
  'org.example.TypescriptTemplate.data.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
)

subdir('icons')
