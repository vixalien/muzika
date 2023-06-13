desktop_file = i18n.merge_file(
        input: 'com.vixalien.muzika.desktop.in',
       output: 'com.vixalien.muzika.desktop',
         type: 'desktop',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'applications')
)

desktop_utils = find_program('desktop-file-validate', required: false)
if desktop_utils.found()
  test('Validate desktop file', desktop_utils, args: [desktop_file])
endif

appdata_conf = configuration_data()
appdata_conf.set('app-id', 'com.vixalien.muzika')

appstream_file = i18n.merge_file(
        input: configure_file(
                  input: 'com.vixalien.muzika.appdata.xml.in.in',
                 output: 'com.vixalien.muzika.appdata.xml.in',
          configuration: appdata_conf
        ),
       output: 'com.vixalien.muzika.appdata.xml',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'appdata')
)

appstream_util = find_program('appstream-util', required: false)
if appstream_util.found()
  test('Validate appstream file', appstream_util, args: ['validate', appstream_file])
endif

gsettings_schema = 'com.vixalien.muzika.gschema.xml'

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

blueprints = custom_target('blueprint', 
  input: files(
    'components/carousel/albumcard.blp',
    'components/carousel/artistcard.blp',
    'components/carousel/carousel.blp',
    'components/carousel/flatsong.blp',
    'components/carousel/playlistcard.blp',
    'components/carousel/songcard.blp',
    'components/carousel/videocard.blp',
    'components/carousel/watchplaylistcard.blp',
    'components/library/history.blp',
    'components/library/mixedcard.blp',
    'components/library/songs.blp',
    'components/library/view.blp',
    'components/nav/page.blp',
    'components/navbar/button.blp',
    'components/navbar/title.blp',
    'components/navbar/index.blp',
    'components/navbar/section.blp',
    'components/player/lyrics.blp',
    'components/player/queue.blp',
    'components/player/queueitem.blp',
    'components/player/related.blp',
    'components/player/view.blp',
    'components/album/item.blp',
    'components/playlist/item.blp',
    'components/playlist/largeheader.blp',
    'components/playlist/miniheader.blp',
    'components/search/inlinecard.blp',
    'components/search/section.blp',
    'components/search/songcard.blp',
    'components/search/topresult.blp',
    'components/search/topresultsection.blp',
    'components/dynamic-image.blp',
    'components/loading.blp',
    'components/paginator.blp',
    'window.blp',
    'gtk/help-overlay.blp',
    'pages/album.blp',
    'pages/artist.blp',
    'pages/authentication-error.blp',
    'pages/error.blp',
    'pages/login.blp',
    'pages/playlist.blp',
    'pages/search.blp',
  ),
  output: '.',
  command: [find_program('blueprint-compiler'), 'batch-compile', '@OUTPUT@', '@CURRENT_SOURCE_DIR@', '@INPUT@']
)

data_res = gnome.compile_resources(
  'com.vixalien.muzika.data',
  'com.vixalien.muzika.data.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
  dependencies: blueprints
)

subdir('icons')
