export const reorderList = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
  if (fromIndex >= items.length || toIndex >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items;
  next.splice(toIndex, 0, moved);
  return next;
};
