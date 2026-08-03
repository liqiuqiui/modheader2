import React from "react";
import { Plus, Trash2, Copy, Settings } from "lucide-react";
import type { Profile } from "../types";
import { Button } from "./ui/button";

interface ProfileSelectorProps {
  profiles: Profile[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onClone: (index: number) => void;
  onOpenOptions: () => void;
}

export function ProfileSelector({
  profiles,
  selectedIndex,
  onSelect,
  onAdd,
  onDelete,
  onClone,
  onOpenOptions,
}: ProfileSelectorProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
          Profiles
        </span>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onAdd} title="Add profile">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onOpenOptions} title="Open options">
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {profiles.map((profile, index) => (
        <div
          key={profile.id}
          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
            index === selectedIndex
              ? "bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]"
              : "hover:bg-[hsl(var(--secondary))]/50"
          }`}
          onClick={() => onSelect(index)}
        >
          {/* Color badge */}
          <div
            className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: profile.backgroundColor,
              color: profile.textColor,
            }}
          >
            {profile.shortTitle}
          </div>

          {/* Title */}
          <span className="flex-1 text-sm truncate">{profile.title}</span>

          {/* Actions (visible on hover) */}
          <div className="hidden group-hover:flex gap-0.5">
            <button
              className="p-0.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              onClick={(e) => { e.stopPropagation(); onClone(index); }}
              title="Clone"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 rounded hover:bg-red-100 text-[hsl(var(--muted-foreground))] hover:text-red-600"
              onClick={(e) => { e.stopPropagation(); onDelete(index); }}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
