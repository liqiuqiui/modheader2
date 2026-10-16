"use client";

import * as React from "react";
import * as CheckboxPrimitive from "radix-ui/checkbox";
import { Check } from "lucide-react";

import { cn } from "../../lib/utils";

/**
 * 规则行的启用开关。它与 `SectionHeader` 里的分组勾选框在视觉上刻意保持一致，
 * 否则同一条规则会出现「方块」和「滑块」两种勾选样式。
 *
 * 底层从 Switch 换成 Checkbox 只是视觉决策：勾选框适合「这一行是否参与」的语义，
 * 而滑动开关通常暗示「某功能即时生效」。两者都只表达二值状态，
 * 对应的行为没有变——仍是点击即写入并触发 DNR 规则重编译。
 *
 * API 与 Switch 基本一致（`checked` / `onCheckedChange`），迁移是逐点替换。
 * 唯一差异：radix Checkbox 的 `onCheckedChange` 传出 `CheckedState`
 * （多了 `"indeterminate"`），而 Switch 只传 boolean。业务侧一律只要
 * 「这一行是否启用」的布尔值，所以这个降级收在组件内部，不外泄到 6 个调用点。
 */
function Checkbox({
  className,
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, "onCheckedChange"> & {
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded border transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "data-checked:border-[var(--theme-color)] data-checked:bg-[var(--theme-color)] data-checked:text-white",
        "data-unchecked:border-slate-300 data-unchecked:bg-white data-unchecked:text-transparent",
        "dark:data-unchecked:border-slate-600 dark:data-unchecked:bg-slate-800",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      onCheckedChange={(checked) => onCheckedChange?.(checked === true)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
