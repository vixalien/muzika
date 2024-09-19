export function seconds_to_string(seconds: number) {
  // show the duration in the format "mm:ss"
  // show hours if the duration is longer than an hour

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  seconds = Math.floor(seconds % 60);

  let string = "";

  if (hours > 0) {
    string += hours.toString().padStart(2, "0") + "∶";
  }

  string += minutes.toString().padStart(2, "0") + "∶";

  string += seconds.toString().padStart(2, "0");

  return string;
}

export function micro_to_seconds(micro: number) {
  return micro / 1000000;
}

export function micro_to_string(micro: number) {
  return seconds_to_string(micro_to_seconds(micro));
}
