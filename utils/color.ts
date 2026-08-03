/** 将 HSL 分量转换为 hex 色值 */
function hslComponent(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function toHex(c: number): string {
  return Math.round(c * 255)
    .toString(16)
    .padStart(2, "0");
}

function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) {
    const v = toHex(l);
    return `#${v}${v}${v}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hslComponent(p, q, h + 1 / 3);
  const g = hslComponent(p, q, h);
  const b = hslComponent(p, q, h - 1 / 3);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** 生成随机的柔和背景色 */
export function randomColor(): string {
  return hslToHex(Math.random(), Math.random(), 0.1 + Math.random() * 0.45);
}

/** 根据背景色亮度决定前景色（黑或白） */
export function getTextColor(bgHex: string): "black" | "white" {
  if (!bgHex) return "white";
  const hex = bgHex.replace("#", "");
  const full = hex.length < 5 ? hex.replace(/./g, "$&$&") : hex;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const luminance = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);
  return luminance > 127.5 ? "black" : "white";
}

/** 取标题最后一个字符作为图标缩略 */
export function getShortTitle(title: string): string {
  const str = String(title);
  return str.length > 0 ? str[str.length - 1] : "?";
}
