import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { CurrentBadge } from "../../../../components/CurrentBadge";
import { useThemePortalContainer } from "../../../../components/ThemePortalProvider";
import { cn } from "../../../../lib/utils";

export interface FilterSelectOption<T extends string> {
  value: T;
  label: string;
  /** 次要说明文字，例如窗口当前显示的标签页标题。 */
  sublabel?: string;
  /** 右上角徽标，例如「当前」。 */
  badge?: string;
  /** 颜色圆点，例如 Tab 组的颜色。 */
  swatch?: string;
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="mr-1.5 inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10 ring-inset"
      style={{ backgroundColor: color }}
    />
  );
}

// Radix `Select` cannot be used inside an extension popup: it mounts a
// `RemoveScroll` body lock and listens to `window.resize` / `blur` to close
// itself, while an extension popup sizes itself to its content. Opening the
// menu therefore resizes the popup and the Select closes immediately.
// `DropdownMenu` has none of that behaviour, so it is used here instead while
// keeping the same props and visual appearance.
export function FilterSelect<T extends string>({
  ariaLabel,
  value,
  options,
  onValueChange,
  className,
  itemClassName,
  autoFocus,
  placeholder,
}: {
  ariaLabel: string;
  value: T;
  options: readonly FilterSelectOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
  autoFocus?: boolean;
  /** 没有选中项（例如取值为 null）时显示的占位文案。 */
  placeholder?: string;
}) {
  const portalContainer = useThemePortalContainer();
  const selected = options.find((option) => option.value === value);
  // An empty value with no matching option would otherwise render a blank
  // trigger, leaving "nothing selected" indistinguishable from a broken row.
  const isPlaceholder = selected === undefined && !value && placeholder !== undefined;
  const selectedLabel = selected?.label ?? (value ? value : (placeholder ?? ""));

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          className={cn(
            "flex h-8 w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-xs font-normal whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:border-ring",
            className,
          )}
        >
          {selected?.swatch && <Swatch color={selected.swatch} />}
          {/* Both halves share one row: the label has to be allowed to shrink
              (group titles can be long) or it would overflow the trigger, while
              the sublabel takes whatever space is left. */}
          <span
            className={cn(
              "min-w-0 truncate text-left",
              selected?.sublabel ? "shrink" : "flex-1",
              // Muted so an unset value reads as "not filled in yet" instead of
              // looking like a real selection.
              isPlaceholder && "text-muted-foreground",
            )}
          >
            {selectedLabel}
          </span>
          {selected?.sublabel && (
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {selected.sublabel}
            </span>
          )}
          {selected?.badge && <CurrentBadge text={selected.badge} />}
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalContainer ?? undefined}>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-100 max-h-72 min-w-(--radix-dropdown-menu-trigger-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={() => onValueChange(option.value)}
              className={cn(
                "relative flex w-full cursor-pointer items-center rounded-md py-1 pr-7 pl-1.5 text-xs font-normal outline-hidden select-none focus:bg-accent focus:text-accent-foreground",
                itemClassName,
              )}
            >
              {option.swatch && <Swatch color={option.swatch} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.sublabel && (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {option.sublabel}
                  </span>
                )}
              </span>
              {option.badge && <CurrentBadge text={option.badge} />}
              {option.value === value && (
                <Check aria-hidden="true" className="pointer-events-none absolute right-2 size-4" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
