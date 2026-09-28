import { useTranslation } from "react-i18next";

export function NoticeToast({
  message,
  dismissible = false,
  onDismiss,
}: {
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[200] flex max-w-xs items-start gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl"
    >
      <span className="flex-1">{message}</span>
      {dismissible ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.close")}
          className="-mr-1 shrink-0 rounded px-1 text-slate-300 transition-colors hover:text-white"
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  );
}
