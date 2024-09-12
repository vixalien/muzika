export function get_volume_icon_name(muted: boolean, volume: number) {
  let icon_name: string;

  if (muted) {
    icon_name = "audio-volume-muted-symbolic";
  } else {
    if (volume === 0) {
      icon_name = "audio-volume-muted-symbolic";
    } else if (volume < 0.33) {
      icon_name = "audio-volume-low-symbolic";
    } else if (volume < 0.66) {
      icon_name = "audio-volume-medium-symbolic";
    } else {
      icon_name = "audio-volume-high-symbolic";
    }
  }

  return icon_name;
}
