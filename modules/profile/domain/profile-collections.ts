import { arrayMoveImmutable } from "array-move";

export function moveItemById<Item extends string>(
  items: Item[],
  sourceId: Item,
  targetId: Item,
): Item[] {
  const sourceIndex = items.indexOf(sourceId);
  const targetIndex = items.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items;
  return arrayMoveImmutable(items, sourceIndex, targetIndex);
}
