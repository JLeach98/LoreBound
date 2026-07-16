import type { ThreadmarkAuthoringRange } from './threadmarkAuthoringTypes';

export type ThreadmarkInsertionResult = Readonly<{
  value: string;
  cursorOffset: number;
}>;

export function replaceThreadmarkTextRange(
  value: string,
  range: ThreadmarkAuthoringRange,
  insertion: string,
): ThreadmarkInsertionResult {
  const start = Math.max(0, Math.min(range.start, value.length));
  const end = Math.max(start, Math.min(range.end, value.length));
  const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;

  return Object.freeze({
    value: nextValue,
    cursorOffset: start + insertion.length,
  });
}

