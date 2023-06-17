export function escape_label(label: string) {
  return label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function indent_stack(stack: string) {
  return escape_label(
    stack
      .split("\n")
      .map((line) => `    ${escape_label(line)}`)
      .join("\n"),
  );
}
