import type { RefObject } from "react";

export function EditorInputs({
  fileInputRef,
  colorInputRef,
  onImport,
  onColorChange,
}: {
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
        defaultValue="#000000"
        className="sr-only"
        onChange={(event) => onColorChange(event.target.value)}
      />
    </>
  );
}
