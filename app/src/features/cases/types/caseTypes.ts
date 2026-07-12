export const universeTypes = [
  'Book',
  'Book Series',
  'Game',
  'Game Series',
  'Movie',
  'Movie Series',
  'Television',
  'Anime',
  'Manga',
  'Tabletop',
  'Original World',
  'Other',
] as const;

export type UniverseType = (typeof universeTypes)[number];

export type LoreCase = {
  id: string;
  caseName: string;
  universeType: UniverseType;
  dateCreated: string;
  dateLastModified: string;
  dateLastOpened: string | null;
  coverImage?: string;
  authorOrCreator?: string;
  description?: string;
};

export type CaseFormValues = {
  caseName: string;
  universeType: UniverseType;
  coverImage?: string;
  authorOrCreator?: string;
  description?: string;
};
