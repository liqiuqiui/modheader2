export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 px-4 py-5 text-center text-xs text-slate-400">
      {label}
    </div>
  );
}
