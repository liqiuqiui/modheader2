import type { RefObject } from "react";
import type { Profile } from "../../../types";

export function EditorInputs({
  profile,
  fileInputRef,
  colorInputRef,
  onImport,
  onColorChange,
}: {
  profile: Profile;
  fileInputRef: RefObject<HTMLInputElement | null>;
  colorInputRef: RefObject<HTMLInputElement | null>;
  onImport: (file?: File) => void;
  onColorChange: (color: string) => void;
}) {
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => onImport(event.target.files?.[0])}
      />
      <input
        ref={colorInputRef}
        type="color"
        value={profile.backgroundColor}
        className="sr-only"
        onChange={(event) => onColorChange(event.target.value)}
      />
    </>
  );
}
