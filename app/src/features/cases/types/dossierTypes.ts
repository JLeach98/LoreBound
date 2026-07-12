export const dossierTypes = [
  'Character',
  'Location',
  'Event',
  'Organization',
  'Theory',
] as const;

export type DossierType = (typeof dossierTypes)[number];

export type CharacterStatus = 'Alive' | 'Deceased' | 'Unknown';
export type TheoryConfidence = 'Low' | 'Medium' | 'High';
export type TheoryStatus = 'Open' | 'Confirmed' | 'Disproven';

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
};

export const dossierTypeLabels: Record<DossierType, string> = {
  Character: 'Character Dossier',
  Location: 'Location Dossier',
  Event: 'Event Dossier',
  Organization: 'Organization Dossier',
  Theory: 'Theory Dossier',
};
