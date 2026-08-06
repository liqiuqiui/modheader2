import { arrayMoveImmutable } from "array-move";

export function moveEntityById<Entity extends { id: string }>(
  entities: Entity[],
  sourceId: string,
  targetId: string,
): Entity[] {
  const sourceIndex = entities.findIndex((entity) => entity.id === sourceId);
  const targetIndex = entities.findIndex((entity) => entity.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return entities;
  return arrayMoveImmutable(entities, sourceIndex, targetIndex);
}
