import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Globe2 } from "lucide-react";
import type { BrowserTab } from "../types/browser";

export function TabIcon({ tab, className = "h-4 w-4" }: { tab?: BrowserTab; className?: string }) {
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
