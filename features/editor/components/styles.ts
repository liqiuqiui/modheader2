export const menuItemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-700 outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 hover:bg-slate-100 focus:bg-slate-100";

export const filterSelectTextClass = "text-xs font-normal text-slate-600";

export function iconButtonClass(disabled = false) {
  return `rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
    disabled ? "cursor-not-allowed opacity-35" : "hover:bg-white/15"
  }`;
}
