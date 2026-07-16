export const bondBehaviors = ['Symmetric', 'Inverse', 'Directional'] as const;
export const bondStatuses = ['Confirmed', 'Theory', 'Unknown', 'Disputed', 'Debunked'] as const;

export type BondBehavior = (typeof bondBehaviors)[number];
export type BondStatus = (typeof bondStatuses)[number];
export type BondOrigin = 'manual' | 'threadmark';

export type ThreadmarkBondRole = 'forward' | 'inverse';

export type ThreadmarkBondMetadata = {
  origin: 'threadmark';
  ownerId: string;
  sourceDossierId: string;
  sourceSectionId: string;
  relationshipKey: string;
  targetDossierId: string;
  occurrenceFingerprint: string;
  generatedAt: string;
  registryVersion: number;
  parserVersion: number;
  resolverVersion: number;
  reconciliationVersion: number;
  pairId: string;
  role: ThreadmarkBondRole;
};

export type BondEvidence = {
  sourceTitle?: string;
  sourceType?: string;
  reference?: string;
  evidenceNotes?: string;
};

export type Bond = {
  id: string;
  caseId: string;
  sourceDossierId: string;
  targetDossierId: string;
  bondType: string;
  bondBehavior: BondBehavior;
  dateCreated: string;
  dateModified: string;
  sourceLabel?: string;
  targetLabel?: string;
  status?: BondStatus;
  notes?: string;
  evidence?: BondEvidence;
  origin?: BondOrigin;
  threadmark?: ThreadmarkBondMetadata;
};

export type BondFormValues = {
  id?: string;
  sourceDossierId: string;
  targetDossierId: string;
  bondType: string;
  bondBehavior: BondBehavior;
  sourceLabel?: string;
  targetLabel?: string;
  status?: BondStatus;
  notes?: string;
  evidence?: BondEvidence;
  origin?: BondOrigin;
  threadmark?: ThreadmarkBondMetadata;
};

export type BondTypeDefinition = {
  name: string;
  behavior: BondBehavior;
  sourceLabel: string;
  targetLabel?: string;
};

export const builtInBondTypes: BondTypeDefinition[] = [
  { name: 'Mother / Child', behavior: 'Inverse', sourceLabel: 'Mother', targetLabel: 'Child' },
  { name: 'Father / Child', behavior: 'Inverse', sourceLabel: 'Father', targetLabel: 'Child' },
  { name: 'Parent / Child', behavior: 'Inverse', sourceLabel: 'Parent', targetLabel: 'Child' },
  { name: 'Daughter / Parent', behavior: 'Inverse', sourceLabel: 'Daughter', targetLabel: 'Parent' },
  { name: 'Son / Parent', behavior: 'Inverse', sourceLabel: 'Son', targetLabel: 'Parent' },
  { name: 'Child / Parent', behavior: 'Inverse', sourceLabel: 'Child', targetLabel: 'Parent' },
  { name: 'Sibling', behavior: 'Symmetric', sourceLabel: 'Sibling' },
  { name: 'Ally', behavior: 'Symmetric', sourceLabel: 'Ally' },
  { name: 'Rival', behavior: 'Symmetric', sourceLabel: 'Rival' },
  { name: 'Romantic Partner', behavior: 'Symmetric', sourceLabel: 'Romantic Partner' },
  { name: 'Friend', behavior: 'Symmetric', sourceLabel: 'Friend' },
  { name: 'Enemy', behavior: 'Symmetric', sourceLabel: 'Enemy' },
  { name: 'Teammate', behavior: 'Symmetric', sourceLabel: 'Teammate' },
  { name: 'Bonded Pair', behavior: 'Symmetric', sourceLabel: 'Bonded Pair' },
  { name: 'Mentor / Student', behavior: 'Inverse', sourceLabel: 'Mentor', targetLabel: 'Student' },
  { name: 'Leader / Member', behavior: 'Inverse', sourceLabel: 'Leader', targetLabel: 'Member' },
  { name: 'Rider / Dragon', behavior: 'Inverse', sourceLabel: 'Rider', targetLabel: 'Dragon' },
  { name: 'Dragon / Rider', behavior: 'Inverse', sourceLabel: 'Dragon', targetLabel: 'Rider' },
  { name: 'Creator / Creation', behavior: 'Inverse', sourceLabel: 'Creator', targetLabel: 'Creation' },
  { name: 'Owner / Possession', behavior: 'Inverse', sourceLabel: 'Owner', targetLabel: 'Possession' },
  { name: 'Suspects', behavior: 'Directional', sourceLabel: 'Suspects' },
  { name: 'Defeated', behavior: 'Directional', sourceLabel: 'Defeated' },
  { name: 'Inspired', behavior: 'Directional', sourceLabel: 'Inspired' },
  { name: 'Influenced', behavior: 'Directional', sourceLabel: 'Influenced' },
  { name: 'Mentions', behavior: 'Directional', sourceLabel: 'Mentions' },
  { name: 'Betrayed', behavior: 'Directional', sourceLabel: 'Betrayed' },
  { name: 'Protects', behavior: 'Directional', sourceLabel: 'Protects' },
  { name: 'Serves', behavior: 'Directional', sourceLabel: 'Serves' },
  { name: 'Rules', behavior: 'Directional', sourceLabel: 'Rules' },
  { name: 'Resides In', behavior: 'Directional', sourceLabel: 'Resides In' },
  { name: 'Located In', behavior: 'Directional', sourceLabel: 'Located In' },
  { name: 'Occurred At', behavior: 'Directional', sourceLabel: 'Occurred At' },
  { name: 'Participated In', behavior: 'Directional', sourceLabel: 'Participated In' },
];

export const customBondTypeName = 'Custom Bond';
