import { cn } from "../lib/utils";

/**
 * 主题色「当前」徽标：TabPicker 与过滤器下拉框共用同一份样式，
 * 调整主题色变量或圆角时只需要改这里。
 */
export function CurrentBadge({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-[color-mix(in_srgb,var(--theme-color)_30%,white)] bg-[color-mix(in_srgb,var(--theme-color)_10%,white)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--theme-color)]",
        className,
      )}
    >
      {text}
    </span>
  );
}
