export const dossierTypes = [
  'Character',
  'Location',
  'Event',
  'Organization',
  'Theory',
  'Artifact',
] as const;

export type DossierType = (typeof dossierTypes)[number];

export type CharacterStatus = 'Alive' | 'Deceased' | 'Unknown';
export type TheoryConfidence = 'Low' | 'Medium' | 'High';
export type TheoryStatus = 'Open' | 'Confirmed' | 'Disproven';
export type DossierSectionKind =
  | 'identity'
  | 'overview'
  | 'notes'
  | 'relationships'
  | 'timeline'
  | 'gallery'
  | 'evidence'
  | 'custom';

export type DossierSectionField = {
  id: string;
  label: string;
  value: string;
};

export type DossierSection = {
  id: string;
  templateId: string;
  kind: DossierSectionKind;
  title: string;
  order: number;
  isCollapsed: boolean;
  isSingleton: boolean;
  fields?: DossierSectionField[];
  body?: string;
};

export type DossierTemplate = {
  id: DossierType;
  name: string;
  sectionTemplateIds: string[];
};

export type Dossier = {
  id: string;
  caseId: string;
  dossierType: DossierType;
  name: string;
  dateCreated: string;
  dateModified: string;
  coverImage?: string;
  summary?: string;
  notes?: string;
  alias?: string;
  characterStatus?: CharacterStatus;
  affiliation?: string;
  region?: string;
  world?: string;
  eventDate?: string;
  era?: string;
  leader?: string;
  organizationType?: string;
  theoryConfidence?: TheoryConfidence;
  theoryStatus?: TheoryStatus;
  sections?: DossierSection[];
};

export type DossierFormValues = {
  dossierType: DossierType;
  name: string;
  coverImage?: string;
  summary?: string;
  notes?: string;
  alias?: string;
  characterStatus?: CharacterStatus;
  affiliation?: string;
  region?: string;
  world?: string;
  eventDate?: string;
  era?: string;
  leader?: string;
  organizationType?: string;
  theoryConfidence?: TheoryConfidence;
  theoryStatus?: TheoryStatus;
  sections?: DossierSection[];
};

export const dossierTypeLabels: Record<DossierType, string> = {
  Character: 'Character Dossier',
  Location: 'Location Dossier',
  Event: 'Event Dossier',
  Organization: 'Organization Dossier',
  Theory: 'Theory Dossier',
  Artifact: 'Artifact Dossier',
};
