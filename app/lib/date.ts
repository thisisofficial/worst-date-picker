export type PickedDate = { day: number; month: string; year: number };

export function formatDate(d: PickedDate) {
  return `${d.month} ${d.day}, ${d.year}`;
}
