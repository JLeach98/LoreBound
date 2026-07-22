import { createStableId } from '../../../lib/stableId';
import type { Dossier, DossierFormValues, DossierSection } from '../types/dossierTypes';
import { ensureDossierSections, normalizeSectionOrder } from './dossierSections';

export const caseFileBlockTypes = [
  'section-heading',
  'paragraph',
  'bulleted-list',
  'numbered-list',
  'quote',
  'divider',
] as const;

export type CaseFileBlockType = (typeof caseFileBlockTypes)[number];

export type CaseFileBlockOption = {
  type: CaseFileBlockType;
  label: string;
  actionLabel: string;
};

export const caseFileBlockOptions: CaseFileBlockOption[] = [
  { type: 'section-heading', label: 'Section Heading', actionLabel: 'Add Heading' },
  { type: 'paragraph', label: 'Paragraph', actionLabel: 'Add Paragraph' },
  { type: 'bulleted-list', label: 'Bulleted List', actionLabel: 'Add Bulleted List' },
  { type: 'numbered-list', label: 'Numbered List', actionLabel: 'Add Numbered List' },
  { type: 'quote', label: 'Quote', actionLabel: 'Add Quote' },
  { type: 'divider', label: 'Divider', actionLabel: 'Add Divider' },
];

const blockTemplatePrefix = 'case-file:';
const blockTemplateIds = new Set(caseFileBlockTypes.map((type) => `${blockTemplatePrefix}${type}`));

function clean(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getCaseFileBlockType(section: DossierSection): CaseFileBlockType | null {
  if (section.templateId.startsWith(blockTemplatePrefix)) {
    const possibleType = section.templateId.slice(blockTemplatePrefix.length);

    if (caseFileBlockTypes.includes(possibleType as CaseFileBlockType)) {
      return possibleType as CaseFileBlockType;
    }
  }

  if (section.kind === 'overview' || section.kind === 'notes' || section.kind === 'custom') {
    return 'paragraph';
  }

  return null;
}

export function isCaseFileContentSection(section: DossierSection) {
  return Boolean(getCaseFileBlockType(section));
}

export function isStructuredCaseFileBlock(section: DossierSection) {
  return blockTemplateIds.has(section.templateId);
}

export function getCaseFileBlockLabel(type: CaseFileBlockType) {
  return caseFileBlockOptions.find((option) => option.type === type)?.label ?? 'Paragraph';
}

export function createCaseFileBlockSection(
  type: CaseFileBlockType = 'paragraph',
  order = 0,
  body = '',
): DossierSection {
  return {
    id: createStableId(`case-file-${type}`),
    templateId: `${blockTemplatePrefix}${type}`,
    kind: 'custom',
    title: getCaseFileBlockLabel(type),
    order,
    isCollapsed: false,
    isSingleton: false,
    body,
  };
}

export function changeCaseFileBlockType(
  section: DossierSection,
  type: CaseFileBlockType,
): DossierSection {
  return {
    ...section,
    templateId: `${blockTemplatePrefix}${type}`,
    kind: 'custom',
    title: getCaseFileBlockLabel(type),
    body: section.body ?? '',
  };
}

export function prepareNotebookSections(sections: DossierSection[]) {
  const normalizedSections = normalizeSectionOrder(sections);
  const sectionsWithoutEmptyDefaultText = normalizedSections.filter(
    (section) => !['overview', 'notes'].includes(section.kind) || Boolean(clean(section.body)),
  );
  const contentSections = sectionsWithoutEmptyDefaultText.filter(isCaseFileContentSection);
  const hasMeaningfulContent = contentSections.some((section) =>
    isStructuredCaseFileBlock(section) ||
    Boolean(clean(section.body)) ||
    (section.kind === 'custom' && Boolean(clean(section.title))),
  );

  if (hasMeaningfulContent) {
    return normalizeSectionOrder(sectionsWithoutEmptyDefaultText);
  }

  return normalizeSectionOrder([
    ...sectionsWithoutEmptyDefaultText,
    createCaseFileBlockSection('paragraph', sectionsWithoutEmptyDefaultText.length),
  ]);
}

export function ensureEditableNotebookSections(dossier: Dossier) {
  return prepareNotebookSections(ensureDossierSections(dossier));
}

export function getCaseFileSections(sections: DossierSection[]) {
  return normalizeSectionOrder(sections).filter(isCaseFileContentSection);
}

export function hasRenderableCaseFileContent(section: DossierSection) {
  const blockType = getCaseFileBlockType(section);

  if (!blockType) {
    return false;
  }

  if (blockType === 'divider') {
    return true;
  }

  return Boolean(clean(section.body));
}

export function getVisibleCaseFileSections(sections: DossierSection[]) {
  return getCaseFileSections(sections).filter(hasRenderableCaseFileContent);
}

export function syncDossierValuesFromNotebookSections(
  values: DossierFormValues,
  sections: DossierSection[],
): DossierFormValues {
  const overviewSection = sections.find((section) => section.kind === 'overview');
  const notesSection = sections.find((section) => section.kind === 'notes');

  return {
    ...values,
    summary: overviewSection?.body ?? values.summary,
    notes: notesSection?.body ?? values.notes,
  };
}
