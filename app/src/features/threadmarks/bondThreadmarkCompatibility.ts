import { builtInBondTypes } from '../cases/types/bondTypes';
import { normalizeThreadmarkAlias } from './threadmarkValidation';

const bondTypeThreadmarkPairs = [
  ['Mother / Child', 'mother'],
  ['Father / Child', 'father'],
  ['Parent / Child', 'parent'],
  ['Daughter / Parent', 'daughter'],
  ['Son / Parent', 'son'],
  ['Child / Parent', 'child'],
  ['Sibling', 'sibling'],
  ['Ally', 'ally'],
  ['Rival', 'rival'],
  ['Romantic Partner', 'romanticPartner'],
  ['Friend', 'friend'],
  ['Enemy', 'enemy'],
  ['Bonded Pair', 'bonded'],
  ['Mentor / Student', 'mentor'],
  ['Leader / Member', 'leader'],
  ['Rider / Dragon', 'rider'],
  ['Dragon / Rider', 'dragon'],
  ['Creator / Creation', 'creator'],
  ['Owner / Possession', 'owner'],
  ['Rules', 'ruler'],
  ['Resides In', 'resident'],
  ['Located In', 'associatedWith'],
  ['Occurred At', 'occurredAt'],
  ['Participated In', 'participant'],
] as const;

const normalizedBondTypeToThreadmark = new Map(
  bondTypeThreadmarkPairs.map(([bondType, threadmarkKey]) => [
    normalizeThreadmarkAlias(bondType),
    threadmarkKey,
  ]),
);

const threadmarkToBondType = new Map<string, string>(
  bondTypeThreadmarkPairs.map(([bondType, threadmarkKey]) => [threadmarkKey, bondType]),
);

export function bondTypeToThreadmarkKey(bondType: string) {
  return normalizedBondTypeToThreadmark.get(normalizeThreadmarkAlias(bondType));
}

export function threadmarkKeyToBondType(key: string) {
  return threadmarkToBondType.get(key);
}

export function getUnmappedBuiltInBondTypes() {
  return builtInBondTypes
    .map((definition) => definition.name)
    .filter((bondType) => !bondTypeToThreadmarkKey(bondType));
}

export function getBondTypeMappingCoverage() {
  const mappedCount = builtInBondTypes.length - getUnmappedBuiltInBondTypes().length;

  return `${mappedCount}/${builtInBondTypes.length}`;
}
