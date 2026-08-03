import { useState } from "react";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { createCookieRule } from "../../../types";
import type { CookieRule } from "../../../types";
import { CookieRuleRow } from "./CookieRuleRow";
import { EmptyState } from "./EmptyState";
import { SectionContent } from "./SectionContent";
import { SectionHeader } from "./SectionHeader";

export function CookieSection({
  cookies,
  searchQuery,
  onChange,
  focusCookieId,
  compact = false,
}: {
  cookies: CookieRule[];
  searchQuery: string;
  onChange: (cookies: CookieRule[]) => void;
  focusCookieId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [localFocusCookieId, setLocalFocusCookieId] = useState<string | null>(null);
  const query = searchQuery.trim().toLowerCase();
  const visibleCookies = cookies.filter(
    (cookie) =>
      !query || `${cookie.name} ${cookie.value} ${cookie.comment}`.toLowerCase().includes(query),
  );
  const enabled = cookies.some((cookie) => cookie.enabled);

  return (
    <section>
      <SectionHeader
        title={t("section.cookies")}
        count={cookies.length}
        open={open}
        enabled={enabled}
        onToggle={() => setOpen((current) => !current)}
        onToggleEnabled={() =>
          onChange(cookies.map((cookie) => ({ ...cookie, enabled: !enabled })))
        }
        onAdd={() => {
          const cookie = createCookieRule();
          setLocalFocusCookieId(cookie.id);
          onChange([...cookies, cookie]);
          setOpen(true);
        }}
        onClear={() => onChange([])}
      />
      <SectionContent open={open} className={clsx(compact ? "space-y-1.5" : "space-y-2")}>
        {visibleCookies.map((cookie) => (
          <CookieRuleRow
            key={cookie.id}
            cookie={cookie}
            compact={compact}
            autoFocus={cookie.id === focusCookieId || cookie.id === localFocusCookieId}
            onChange={(patch) =>
              onChange(
                cookies.map((item) => (item.id === cookie.id ? { ...item, ...patch } : item)),
              )
            }
            onDelete={() => onChange(cookies.filter((item) => item.id !== cookie.id))}
            onClone={() => {
              const clone = { ...cookie, id: createCookieRule().id };
              setLocalFocusCookieId(clone.id);
              onChange([...cookies, clone]);
            }}
          />
        ))}
        {!compact && cookies.length === 0 && (
          <EmptyState label={t("section.noRules", { title: t("section.cookies") })} />
        )}
        {cookies.length > 0 && visibleCookies.length === 0 && (
          <EmptyState label={t("section.noMatchedRules")} />
        )}
      </SectionContent>
    </section>
  );
}
