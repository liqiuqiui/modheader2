import { memo, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Globe2 } from "lucide-react";
import type { BrowserTab } from "../types/browser";

interface TabIconProps {
  tab?: BrowserTab;
  className?: string;
}

function TabIconComponent({ tab, className = "h-4 w-4" }: TabIconProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [tab?.favIconUrl]);

  if (tab?.favIconUrl && !failed) {
    return (
      <img
        src={tab.favIconUrl}
        alt=""
        loading="lazy"
        className={clsx(className, "rounded-sm object-contain")}
        onError={() => setFailed(true)}
      />
    );
  }

  return <Globe2 aria-hidden="true" className={clsx(className, "text-slate-400")} />;
}

export const TabIcon = memo(
  TabIconComponent,
  (previous, next) =>
    previous.className === next.className && previous.tab?.favIconUrl === next.tab?.favIconUrl,
);
