function hslComponent(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function toHex(component: number): string {
  return Math.round(component * 255)
    .toString(16)
    .padStart(2, "0");
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  if (saturation === 0) {
    const value = toHex(lightness);
    return `#${value}${value}${value}`;
  }
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return `#${toHex(hslComponent(p, q, hue + 1 / 3))}${toHex(
    hslComponent(p, q, hue),
  )}${toHex(hslComponent(p, q, hue - 1 / 3))}`;
}

export function randomProfileColor(): string {
  return hslToHex(Math.random(), Math.random(), 0.1 + Math.random() * 0.45);
}

export function getProfileTextColor(backgroundColor: string): "black" | "white" {
  if (!backgroundColor) return "white";
  const hex = backgroundColor.replace("#", "");
  const full = hex.length < 5 ? hex.replace(/./g, "$&$&") : hex;
  const value = Number.parseInt(full, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  const luminance = Math.sqrt(0.299 * red * red + 0.587 * green * green + 0.114 * blue * blue);
  return luminance > 127.5 ? "black" : "white";
}

export function getProfileShortTitle(title: string): string {
  const value = String(title);
  return value.length > 0 ? value[value.length - 1] : "?";
}
