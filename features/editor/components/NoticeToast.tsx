export function NoticeToast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[200] rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl"
    >
      {message}
    </div>
  );
}
