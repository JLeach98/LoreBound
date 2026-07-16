import type { ThreadmarkSourceRange } from './threadmarkParserTypes';
import { resolveCanonicalThreadmarkKey } from './threadmarkSelectors';

export type ThreadmarkTokenCandidate = Readonly<{
  startOffset: number;
  relationshipToken: string;
  relationshipInput: string;
  relationshipEndOffset: number;
  targetToken?: string;
  targetText?: string;
  targetQuery?: string;
  targetStartOffset?: number;
  targetEndOffset?: number;
  endOffset: number;
  hasTargetMarker: boolean;
  targetMalformed: boolean;
}>;

export type ThreadmarkTokenizerContext = Readonly<{
  escapedTokenCount: number;
  excludedRangeCount: number;
}>;

const relationshipCharacterPattern = /[A-Za-z0-9_-]/;
const sentenceBoundaryPunctuation = new Set(['.', ',', ';', ':', '!', '?']);

function isRelationshipCharacter(value: string) {
  return relationshipCharacterPattern.test(value);
}

function isWhitespace(value: string) {
  return /\s/.test(value);
}

function isWordLike(value: string | undefined) {
  return Boolean(value && /[A-Za-z0-9._%+-]/.test(value));
}

function isEscapedAt(input: string, offset: number) {
  let slashCount = 0;

  for (let index = offset - 1; index >= 0 && input[index] === '\\'; index -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function isInsideExcludedRange(offset: number, excludedRanges: readonly ThreadmarkSourceRange[]) {
  return excludedRanges.some((range) => offset >= range.start && offset < range.end);
}

function isLikelyEmailAt(input: string, offset: number) {
  return isWordLike(input[offset - 1]) && isWordLike(input[offset + 1]);
}

function isLikelyUrlAt(input: string, offset: number) {
  const previousWhitespace = Math.max(
    input.lastIndexOf(' ', offset),
    input.lastIndexOf('\n', offset),
    input.lastIndexOf('\t', offset),
  );
  const tokenPrefix = input.slice(previousWhitespace + 1, offset);

  return (
    tokenPrefix.includes('://') ||
    tokenPrefix.startsWith('www.') ||
    input[offset - 1] === '/'
  );
}

function canStartThreadmarkAt(input: string, offset: number) {
  if (input[offset] !== '@') {
    return false;
  }

  if (isEscapedAt(input, offset) || isLikelyEmailAt(input, offset) || isLikelyUrlAt(input, offset)) {
    return false;
  }

  const previous = input[offset - 1];

  return !previous || isWhitespace(previous) || /[([{"'`—–-]/.test(previous);
}

function readRelationshipToken(input: string, startOffset: number) {
  let cursor = startOffset + 1;

  while (cursor < input.length && isRelationshipCharacter(input[cursor])) {
    cursor += 1;
  }

  return {
    relationshipToken: input.slice(startOffset, cursor),
    relationshipInput: input.slice(startOffset + 1, cursor),
    relationshipEndOffset: cursor,
  };
}

function trimTargetBoundary(value: string) {
  let targetText = value.replace(/\s+$/u, '');
  targetText = targetText.replace(/\s+(and|or)$/iu, '');
  targetText = targetText.replace(/[.,;:!?]+$/u, '');
  targetText = targetText.replace(/\s+$/u, '');

  return targetText;
}

function isRecognizedRelationshipStart(input: string, offset: number) {
  if (!canStartThreadmarkAt(input, offset)) {
    return false;
  }

  const token = readRelationshipToken(input, offset);

  return Boolean(token.relationshipInput && resolveCanonicalThreadmarkKey(token.relationshipInput));
}

function findTargetEnd(input: string, targetTextStart: number) {
  let cursor = targetTextStart;

  while (cursor < input.length) {
    const character = input[cursor];
    const nextCharacter = input[cursor + 1];

    if (character === '\n') {
      break;
    }

    if (
      sentenceBoundaryPunctuation.has(character) &&
      (!nextCharacter || isWhitespace(nextCharacter))
    ) {
      break;
    }

    if (character === '@' && isRecognizedRelationshipStart(input, cursor)) {
      break;
    }

    cursor += 1;
  }

  const rawTargetText = input.slice(targetTextStart, cursor);
  const trimmedTargetText = trimTargetBoundary(rawTargetText);

  return {
    targetText: trimmedTargetText,
    targetEndOffset: targetTextStart + trimmedTargetText.length,
    scanEndOffset: cursor,
  };
}

export function countEscapedThreadmarkTokens(input: string) {
  let count = 0;

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === '@' && isEscapedAt(input, index)) {
      count += 1;
    }
  }

  return count;
}

export function tokenizeThreadmarkAt(
  input: string,
  startOffset: number,
): ThreadmarkTokenCandidate | null {
  if (!canStartThreadmarkAt(input, startOffset)) {
    return null;
  }

  const relationship = readRelationshipToken(input, startOffset);
  let cursor = relationship.relationshipEndOffset;

  while (cursor < input.length && input[cursor] !== '\n' && isWhitespace(input[cursor])) {
    cursor += 1;
  }

  if (input[cursor] !== '@' || !canStartThreadmarkAt(input, cursor)) {
    return Object.freeze({
      ...relationship,
      startOffset,
      endOffset: relationship.relationshipEndOffset,
      hasTargetMarker: false,
      targetMalformed: false,
    });
  }

  const targetStartOffset = cursor;
  const targetTextStart = targetStartOffset + 1;
  const target = findTargetEnd(input, targetTextStart);
  const targetToken = input.slice(targetStartOffset, target.targetEndOffset);
  const endOffset =
    target.targetText.length > 0 ? target.targetEndOffset : Math.max(target.scanEndOffset, targetStartOffset + 1);

  return Object.freeze({
    ...relationship,
    startOffset,
    targetToken,
    targetText: target.targetText,
    targetQuery: target.targetText.trim(),
    targetStartOffset,
    targetEndOffset: target.targetEndOffset,
    endOffset,
    hasTargetMarker: true,
    targetMalformed: target.targetText.length === 0 && target.scanEndOffset > targetTextStart,
  });
}

export function collectTokenizerContext(
  input: string,
  excludedRanges: readonly ThreadmarkSourceRange[],
): ThreadmarkTokenizerContext {
  return Object.freeze({
    escapedTokenCount: countEscapedThreadmarkTokens(input),
    excludedRangeCount: excludedRanges.length,
  });
}

export function shouldSkipThreadmarkOffset(
  input: string,
  offset: number,
  excludedRanges: readonly ThreadmarkSourceRange[],
) {
  return (
    input[offset] !== '@' ||
    isInsideExcludedRange(offset, excludedRanges) ||
    !canStartThreadmarkAt(input, offset)
  );
}

