import { clsx } from "clsx";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

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
  return (
    <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as T)}>
      <SelectTrigger aria-label={ariaLabel} className={clsx(className)} autoFocus={autoFocus}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className={itemClassName}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
