scalable_dir = join_paths('hicolor', 'scalable', 'apps')
install_data(
  join_paths(scalable_dir, application_id + '.svg'),
  install_dir: join_paths(muzika_datadir, 'icons', scalable_dir)
)

symbolic_dir = join_paths('hicolor', 'symbolic', 'apps')
install_data(
  join_paths(symbolic_dir, base_name + '-symbolic.svg'),
  install_dir: join_paths(muzika_datadir, 'icons', symbolic_dir),
  rename: application_id + '-symbolic.svg'
)
