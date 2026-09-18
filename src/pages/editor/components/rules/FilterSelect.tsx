import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { useThemePortalContainer } from "../../../../components/ThemePortalProvider";
import { cn } from "../../../../lib/utils";

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
}: {
  ariaLabel: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onValueChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
  autoFocus?: boolean;
}) {
  const portalContainer = useThemePortalContainer();
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

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
          <span className="min-w-0 truncate">{selectedLabel}</span>
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
              <span className="min-w-0 truncate">{option.label}</span>
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
