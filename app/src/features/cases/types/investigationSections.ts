export const investigationSections = [
  'Board',
  'Characters',
  'Locations',
  'Events',
  'Organizations',
  'Theories',
  'Timeline',
  'Case Settings',
] as const;

export type InvestigationSection = (typeof investigationSections)[number];

export type NavigationSection = 'Case Archive' | InvestigationSection;

export const sectionEmptyStates: Record<
  InvestigationSection,
  {
    heading: string;
    message: string;
  }
> = {
  Board: {
    heading: 'Board',
    message: 'No evidence has been added to this Board yet.',
  },
  Characters: {
    heading: 'Characters',
    message: 'No Character Dossiers have been created.',
  },
  Locations: {
    heading: 'Locations',
    message: 'No Location Dossiers have been created.',
  },
  Events: {
    heading: 'Events',
    message: 'No Event Dossiers have been created.',
  },
  Organizations: {
    heading: 'Organizations',
    message: 'No Organization Dossiers have been created.',
  },
  Theories: {
    heading: 'Theories',
    message: 'No Theory Dossiers have been created.',
  },
  Timeline: {
    heading: 'Timeline',
    message: 'No Events are available to place on the Timeline.',
  },
  'Case Settings': {
    heading: 'Case Settings',
    message: 'Review or edit this Case file.',
  },
};
