app_conf = configuration_data()
app_conf.set('app-id', application_id)
app_conf.set('gettext-package', gettext_package)

desktop_file = i18n.merge_file(
  input: configure_file(
    input: base_name + '.desktop.in.in',
    output: '@BASENAME@',
    configuration: app_conf
  ),
  output: application_id + '.desktop',
  type: 'desktop',
  po_dir: '../po',
  install: true,
  install_dir: join_paths(muzika_datadir, 'applications')
)

desktop_utils = find_program('desktop-file-validate', required: false)
if desktop_utils.found()
  test('Validate desktop file', desktop_utils, args: [desktop_file])
endif

appstream_file = i18n.merge_file(
  input: configure_file(
    input: base_name + '.metainfo.xml.in.in',
    output: base_name + '.metainfo.xml.in',
    configuration: app_conf
  ),
  output: application_id + '.metainfo.xml',
  po_dir: '../po',
  install: true,
  install_dir: join_paths(muzika_datadir, 'metainfo'),
)

appstreamcli = find_program('appstreamcli', required: false)
if (appstreamcli.found())
  test('Validate appdata file',
    appstreamcli,
    args: ['validate', '--no-net', '--explain', appstream_file],
    workdir: meson.current_build_dir()
  )
endif

gsettings_schema = configure_file(
  input: base_name + '.gschema.xml.in',
  output: application_id + '.gschema.xml',
  configuration: app_conf,
  install: true,
  install_dir: muzika_schemadir
)

compile_schemas = find_program('glib-compile-schemas', required: false)

compile_local_schemas = custom_target(
  'compile_local_schemas',
  input: gsettings_schema,
  output: 'gschemas.compiled',
  command: [compile_schemas, meson.current_build_dir()]
)

if compile_schemas.found()
  test('Validate schema file',
       compile_schemas,
       args: ['--strict', '--dry-run', meson.current_source_dir()])
endif

subdir('ui')

gresource_conf = configuration_data()
gresource_conf.merge_from(app_conf)
gresource_conf.set('ui-resources', ui_xml)

data_res = gnome.compile_resources(
  application_id + '.data',
  configure_file(
    input: base_name + '.data.gresource.xml.in',
    output: application_id + '.data.gresource.xml.in',
    configuration: gresource_conf,
  ),
  gresource_bundle: true,
  install: true,
  install_dir: muzika_pkgdatadir,
  dependencies: [blueprints, appstream_file],
)

subdir('icons')
