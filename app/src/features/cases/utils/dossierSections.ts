import type {
  Dossier,
  DossierFormValues,
  DossierSection,
  DossierSectionField,
  DossierSectionKind,
  DossierTemplate,
  DossierType,
} from '../types/dossierTypes';

export type SectionTemplate = {
  id: string;
  title: string;
  kind: DossierSectionKind;
  isSingleton: boolean;
  category: string;
  isProtected?: boolean;
  isRenameable?: boolean;
  isDuplicable?: boolean;
};

const customSectionTemplateStorageKey = 'lorebound:custom-section-templates';

export const builtInSectionTemplates: SectionTemplate[] = [
  { id: 'identity', title: 'Identity', kind: 'identity', isSingleton: true, category: 'Identity', isProtected: true },
  { id: 'aliases', title: 'Aliases', kind: 'custom', isSingleton: false, category: 'Identity', isRenameable: true, isDuplicable: true },
  { id: 'titles', title: 'Titles', kind: 'custom', isSingleton: false, category: 'Identity', isRenameable: true, isDuplicable: true },
  { id: 'species', title: 'Species', kind: 'custom', isSingleton: false, category: 'Identity', isRenameable: true, isDuplicable: true },
  { id: 'occupation', title: 'Occupation', kind: 'custom', isSingleton: false, category: 'Identity', isRenameable: true, isDuplicable: true },
  { id: 'physical-appearance', title: 'Physical Appearance', kind: 'custom', isSingleton: false, category: 'Appearance', isRenameable: true, isDuplicable: true },
  { id: 'clothing', title: 'Clothing', kind: 'custom', isSingleton: false, category: 'Appearance', isRenameable: true, isDuplicable: true },
  { id: 'distinguishing-features', title: 'Distinguishing Features', kind: 'custom', isSingleton: false, category: 'Appearance', isRenameable: true, isDuplicable: true },
  { id: 'personality', title: 'Personality', kind: 'custom', isSingleton: false, category: 'Character', isRenameable: true, isDuplicable: true },
  { id: 'strengths', title: 'Strengths', kind: 'custom', isSingleton: false, category: 'Character', isRenameable: true, isDuplicable: true },
  { id: 'weaknesses', title: 'Weaknesses', kind: 'custom', isSingleton: false, category: 'Character', isRenameable: true, isDuplicable: true },
  { id: 'motivations', title: 'Motivations', kind: 'custom', isSingleton: false, category: 'Character', isRenameable: true, isDuplicable: true },
  { id: 'abilities', title: 'Abilities', kind: 'custom', isSingleton: false, category: 'Abilities', isRenameable: true, isDuplicable: true },
  { id: 'powers', title: 'Powers', kind: 'custom', isSingleton: false, category: 'Abilities', isRenameable: true, isDuplicable: true },
  { id: 'skills', title: 'Skills', kind: 'custom', isSingleton: false, category: 'Abilities', isRenameable: true, isDuplicable: true },
  { id: 'weapons', title: 'Weapons', kind: 'custom', isSingleton: false, category: 'Abilities', isRenameable: true, isDuplicable: true },
  { id: 'artifacts-section', title: 'Artifacts', kind: 'custom', isSingleton: false, category: 'Abilities', isRenameable: true, isDuplicable: true },
  { id: 'history', title: 'History', kind: 'custom', isSingleton: false, category: 'Story', isRenameable: true, isDuplicable: true },
  { id: 'timeline', title: 'Timeline', kind: 'timeline', isSingleton: true, category: 'Story' },
  { id: 'first-appearance', title: 'First Appearance', kind: 'custom', isSingleton: false, category: 'Story', isRenameable: true, isDuplicable: true },
  { id: 'relationships', title: 'Bonds', kind: 'relationships', isSingleton: true, category: 'Connections', isProtected: true },
  { id: 'family', title: 'Family', kind: 'custom', isSingleton: false, category: 'Connections', isRenameable: true, isDuplicable: true },
  { id: 'allies', title: 'Allies', kind: 'custom', isSingleton: false, category: 'Connections', isRenameable: true, isDuplicable: true },
  { id: 'enemies', title: 'Enemies', kind: 'custom', isSingleton: false, category: 'Connections', isRenameable: true, isDuplicable: true },
  { id: 'organizations-section', title: 'Organizations', kind: 'custom', isSingleton: false, category: 'Connections', isRenameable: true, isDuplicable: true },
  { id: 'quotes', title: 'Quotes', kind: 'custom', isSingleton: false, category: 'Research', isRenameable: true, isDuplicable: true },
  { id: 'trivia', title: 'Trivia', kind: 'custom', isSingleton: false, category: 'Research', isRenameable: true, isDuplicable: true },
  { id: 'theories-section', title: 'Theories', kind: 'custom', isSingleton: false, category: 'Research', isRenameable: true, isDuplicable: true },
  { id: 'sources', title: 'Sources', kind: 'custom', isSingleton: false, category: 'Research', isRenameable: true, isDuplicable: true },
  { id: 'overview', title: 'Overview', kind: 'overview', isSingleton: true, category: 'Investigation' },
  { id: 'notes', title: 'Investigation Notes', kind: 'notes', isSingleton: true, category: 'Investigation' },
  { id: 'evidence', title: 'Evidence', kind: 'evidence', isSingleton: true, category: 'Investigation' },
  { id: 'gallery', title: 'Gallery', kind: 'gallery', isSingleton: true, category: 'Investigation' },
  { id: 'attachments', title: 'Attachments', kind: 'custom', isSingleton: false, category: 'Investigation', isRenameable: true, isDuplicable: true },
  { id: 'tags', title: 'Tags', kind: 'custom', isSingleton: false, category: 'Investigation', isRenameable: true, isDuplicable: true },
];

export const dossierTemplates: Record<DossierType, DossierTemplate> = {
  Character: {
    id: 'Character',
    name: 'Character Dossier',
    sectionTemplateIds: ['identity', 'overview', 'notes', 'relationships'],
  },
  Location: {
    id: 'Location',
    name: 'Location Dossier',
    sectionTemplateIds: ['identity', 'overview', 'notes', 'relationships'],
  },
  Event: {
    id: 'Event',
    name: 'Event Dossier',
    sectionTemplateIds: ['identity', 'overview', 'notes', 'relationships', 'timeline'],
  },
  Organization: {
    id: 'Organization',
    name: 'Organization Dossier',
    sectionTemplateIds: ['identity', 'overview', 'notes', 'relationships'],
  },
  Theory: {
    id: 'Theory',
    name: 'Theory Dossier',
    sectionTemplateIds: ['identity', 'overview', 'notes', 'relationships', 'evidence'],
  },
  Artifact: {
    id: 'Artifact',
    name: 'Artifact Dossier',
    sectionTemplateIds: ['identity', 'overview', 'notes', 'relationships', 'gallery'],
  },
};

function createSectionId(templateId: string) {
  return `${templateId}-${crypto.randomUUID()}`;
}

function clean(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function getIdentityFields(dossier: Dossier | DossierFormValues): DossierSectionField[] {
  if (dossier.dossierType === 'Character') {
    return [
      { id: 'alias', label: 'Alias', value: clean(dossier.alias) ?? '' },
      { id: 'characterStatus', label: 'Status', value: dossier.characterStatus ?? 'Unknown' },
      { id: 'affiliation', label: 'Affiliation', value: clean(dossier.affiliation) ?? '' },
    ].filter((field) => field.value);
  }

  if (dossier.dossierType === 'Location') {
    return [
      { id: 'region', label: 'Region', value: clean(dossier.region) ?? '' },
      { id: 'world', label: 'World', value: clean(dossier.world) ?? '' },
    ].filter((field) => field.value);
  }

  if (dossier.dossierType === 'Event') {
    return [
      { id: 'eventDate', label: 'Date', value: clean(dossier.eventDate) ?? '' },
      { id: 'era', label: 'Era', value: clean(dossier.era) ?? '' },
    ].filter((field) => field.value);
  }

  if (dossier.dossierType === 'Organization') {
    return [
      { id: 'leader', label: 'Leader', value: clean(dossier.leader) ?? '' },
      { id: 'organizationType', label: 'Type', value: clean(dossier.organizationType) ?? '' },
    ].filter((field) => field.value);
  }

  if (dossier.dossierType === 'Theory') {
    return [
      { id: 'theoryConfidence', label: 'Confidence', value: dossier.theoryConfidence ?? 'Medium' },
      { id: 'theoryStatus', label: 'Status', value: dossier.theoryStatus ?? 'Open' },
    ].filter((field) => field.value);
  }

  return [];
}

function createSection(
  template: SectionTemplate,
  order: number,
  dossier: Dossier | DossierFormValues,
): DossierSection {
  const baseSection = {
    id: createSectionId(template.id),
    templateId: template.id,
    kind: template.kind,
    title: template.title,
    order,
    isCollapsed: false,
    isSingleton: template.isSingleton,
  };

  if (template.kind === 'identity') {
    return { ...baseSection, fields: getIdentityFields(dossier) };
  }

  if (template.kind === 'overview') {
    return { ...baseSection, body: clean(dossier.summary) };
  }

  if (template.kind === 'notes') {
    return { ...baseSection, body: clean(dossier.notes) };
  }

  return baseSection;
}

export function createDefaultDossierSections(values: Dossier | DossierFormValues) {
  const template = dossierTemplates[values.dossierType];

  return template.sectionTemplateIds
    .map((templateId) => builtInSectionTemplates.find((section) => section.id === templateId))
    .filter((section): section is SectionTemplate => Boolean(section))
    .map((section, index) => createSection(section, index, values));
}

export function ensureDossierSections(dossier: Dossier) {
  const sections = dossier.sections?.length ? dossier.sections : createDefaultDossierSections(dossier);

  return [...sections].sort((left, right) => left.order - right.order);
}

export function mergeDossierSectionsWithFormValues(dossier: Dossier, values: DossierFormValues) {
  const refreshedDefaults = createDefaultDossierSections(values);
  const refreshedByTemplate = new Map(refreshedDefaults.map((section) => [section.templateId, section]));
  const existingSections = ensureDossierSections(dossier);
  const mergedSections = existingSections.map((section) => {
    const refreshedSection = refreshedByTemplate.get(section.templateId);

    if (!refreshedSection || section.kind === 'custom') {
      return section;
    }

    return {
      ...section,
      fields: refreshedSection.fields,
      body: refreshedSection.body,
      title: refreshedSection.title,
      kind: refreshedSection.kind,
      isSingleton: refreshedSection.isSingleton,
    };
  });
  const existingTemplateIds = new Set(mergedSections.map((section) => section.templateId));
  const missingDefaults = refreshedDefaults.filter(
    (section) => !existingTemplateIds.has(section.templateId),
  );

  return normalizeSectionOrder([...mergedSections, ...missingDefaults]);
}

export function normalizeSectionOrder(sections: DossierSection[]) {
  return sections.map((section, index) => ({ ...section, order: index }));
}

export function dossierToFormValues(dossier: Dossier): DossierFormValues {
  return {
    dossierType: dossier.dossierType,
    name: dossier.name,
    coverImage: dossier.coverImage,
    summary: dossier.summary,
    notes: dossier.notes,
    alias: dossier.alias,
    characterStatus: dossier.characterStatus,
    affiliation: dossier.affiliation,
    region: dossier.region,
    world: dossier.world,
    eventDate: dossier.eventDate,
    era: dossier.era,
    leader: dossier.leader,
    organizationType: dossier.organizationType,
    theoryConfidence: dossier.theoryConfidence,
    theoryStatus: dossier.theoryStatus,
    sections: ensureDossierSections(dossier),
  };
}

export function readCustomSectionTemplates(): SectionTemplate[] {
  try {
    const rawValue = window.localStorage.getItem(customSectionTemplateStorageKey);
    const parsedValue = rawValue ? (JSON.parse(rawValue) as SectionTemplate[]) : [];

    return parsedValue.filter((template) => template.id && template.title);
  } catch {
    return [];
  }
}

export function saveCustomSectionTemplate(title: string, kind: DossierSectionKind = 'custom') {
  const template: SectionTemplate = {
    id: `custom-${crypto.randomUUID()}`,
    title: title.trim(),
    kind,
    isSingleton: false,
    category: 'Custom',
    isRenameable: true,
    isDuplicable: true,
  };
  const templates = [...readCustomSectionTemplates(), template];

  window.localStorage.setItem(customSectionTemplateStorageKey, JSON.stringify(templates));
  return template;
}

export function getSectionTemplate(templateId: string) {
  return builtInSectionTemplates.find((template) => template.id === templateId);
}

export function getSectionCapabilities(section: DossierSection) {
  const template = getSectionTemplate(section.templateId);
  const isProtected = Boolean(template?.isProtected);
  const isRenameable = section.kind === 'custom' || Boolean(template?.isRenameable);
  const isDuplicable = !section.isSingleton && (section.kind === 'custom' || Boolean(template?.isDuplicable));

  return {
    canRename: isRenameable,
    canDuplicate: isDuplicable && !isProtected,
    canRemove: !isProtected,
  };
}

export function duplicateSection(section: DossierSection): DossierSection {
  return {
    ...section,
    id: createSectionId(section.templateId),
    title: `${section.title} Copy`,
    isCollapsed: false,
  };
}

export function createSectionFromTemplate(template: SectionTemplate, order: number): DossierSection {
  const supportsBody = ['custom', 'overview', 'notes'].includes(template.kind);

  return {
    id: createSectionId(template.id),
    templateId: template.id,
    kind: template.kind,
    title: template.title,
    order,
    isCollapsed: false,
    isSingleton: template.isSingleton,
    body: supportsBody ? '' : undefined,
  };
}
