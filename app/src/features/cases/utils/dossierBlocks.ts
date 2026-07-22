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

export type CaseFileDocumentLineFormat = 'heading' | 'paragraph' | 'quote' | 'divider';

export type CaseFileDocumentDraft = {
  text: string;
  lineFormats: Record<number, CaseFileDocumentLineFormat>;
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

function formattedListLines(type: 'bulleted-list' | 'numbered-list', body?: string) {
  return (body ?? '')
    .split(/\n+/)
    .map((item) => item.replace(/^[-\d.\s]+/, '').trim())
    .filter(Boolean)
    .map((item, index) => (type === 'bulleted-list' ? `- ${item}` : `${index + 1}. ${item}`));
}

export function blocksToDocumentDraft(sections: DossierSection[]): CaseFileDocumentDraft {
  const lines: string[] = [];
  const lineFormats: Record<number, CaseFileDocumentLineFormat> = {};
  let lastAddedType: CaseFileBlockType | 'legacy-heading' | null = null;

  function addBlankLine() {
    if (lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }
  }

  getCaseFileSections(sections).forEach((section) => {
    const blockType = getCaseFileBlockType(section);

    if (!blockType) {
      return;
    }

    if (!isStructuredCaseFileBlock(section) && section.title.trim() && section.title !== 'Overview' && section.title !== 'Investigation Notes') {
      addBlankLine();
      lineFormats[lines.length] = 'heading';
      lines.push(section.title.trim());
      lastAddedType = 'legacy-heading';

      if (section.body?.trim()) {
        section.body.split('\n').forEach((line) => lines.push(line));
        lastAddedType = 'paragraph';
      }

      return;
    }

    if (blockType === 'divider') {
      addBlankLine();
      lineFormats[lines.length] = 'divider';
      lines.push('---');
      lastAddedType = blockType;
      return;
    }

    if (blockType === 'bulleted-list' || blockType === 'numbered-list') {
      if (lastAddedType !== 'section-heading' && lastAddedType !== 'legacy-heading') {
        addBlankLine();
      }
      lines.push(...formattedListLines(blockType, section.body));
      lastAddedType = blockType;
      return;
    }

    if (blockType === 'section-heading') {
      addBlankLine();
      lineFormats[lines.length] = 'heading';
      lines.push(section.body?.trim() || section.title.trim());
      lastAddedType = blockType;
      return;
    }

    if (blockType === 'quote') {
      addBlankLine();
      const quoteLines = section.body?.split('\n') ?? [''];
      quoteLines.forEach((line) => {
        lineFormats[lines.length] = 'quote';
        lines.push(line);
      });
      lastAddedType = blockType;
      return;
    }

    if (section.body?.trim()) {
      addBlankLine();
      section.body.split('\n').forEach((line) => lines.push(line));
      lastAddedType = blockType;
    }
  });

  return {
    text: lines.join('\n').trimEnd(),
    lineFormats,
  };
}

function createSectionFromParsedBlock(
  type: CaseFileBlockType,
  body: string,
  order: number,
  existingSection?: DossierSection,
) {
  const baseSection = existingSection
    ? changeCaseFileBlockType(existingSection, type)
    : createCaseFileBlockSection(type, order);

  return {
    ...baseSection,
    order,
    body,
  };
}

export function documentDraftToBlocks(
  draft: CaseFileDocumentDraft,
  currentSections: DossierSection[],
) {
  const existingCaseFileSections = getCaseFileSections(currentSections);
  const nonCaseFileSections = normalizeSectionOrder(currentSections).filter(
    (section) => !isCaseFileContentSection(section),
  );
  const parsedSections: DossierSection[] = [];
  const lines = draft.text.replace(/\r\n?/g, '\n').split('\n');
  let existingCursor = 0;
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let listType: 'bulleted-list' | 'numbered-list' | null = null;
  let quoteBuffer: string[] = [];

  function nextExistingSection() {
    const section = existingCaseFileSections[existingCursor];
    existingCursor += 1;
    return section;
  }

  function addParsedSection(type: CaseFileBlockType, body = '') {
    if (type !== 'divider' && !body.trim()) {
      return;
    }

    parsedSections.push(
      createSectionFromParsedBlock(type, body.trimEnd(), nonCaseFileSections.length + parsedSections.length, nextExistingSection()),
    );
  }

  function flushParagraph() {
    if (paragraphBuffer.some((line) => line.trim())) {
      addParsedSection('paragraph', paragraphBuffer.join('\n'));
    }

    paragraphBuffer = [];
  }

  function flushList() {
    if (listType && listBuffer.length > 0) {
      addParsedSection(listType, listBuffer.join('\n'));
    }

    listBuffer = [];
    listType = null;
  }

  function flushQuote() {
    if (quoteBuffer.some((line) => line.trim())) {
      addParsedSection('quote', quoteBuffer.join('\n'));
    }

    quoteBuffer = [];
  }

  function flushAll() {
    flushParagraph();
    flushList();
    flushQuote();
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const trimmedLine = line.trim();
    const format = draft.lineFormats[index];
    const headingCommand = trimmedLine.match(/^\/heading(?:\s+(.*))?$/i);
    const paragraphCommand = trimmedLine.match(/^\/paragraph(?:\s+(.*))?$/i);
    const bulletsCommand = trimmedLine.match(/^\/bullets(?:\s+(.*))?$/i);
    const numberedCommand = trimmedLine.match(/^\/numbered(?:\s+(.*))?$/i);
    const quoteCommand = trimmedLine.match(/^\/quote(?:\s+(.*))?$/i);

    if (!trimmedLine) {
      flushAll();
      return;
    }

    if (format === 'divider' || /^\/divider$/i.test(trimmedLine) || trimmedLine === '---') {
      flushAll();
      addParsedSection('divider');
      return;
    }

    if (format === 'heading' || headingCommand) {
      flushAll();
      addParsedSection('section-heading', headingCommand?.[1] ?? line);
      return;
    }

    if (format === 'quote' || quoteCommand) {
      flushParagraph();
      flushList();
      quoteBuffer.push(quoteCommand?.[1] ?? line.replace(/^>\s?/, ''));
      return;
    }

    const bulletMatch = line.match(/^\s*-\s+(.*)$/);
    const numberedMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (bulletsCommand) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'bulleted-list') {
        flushList();
      }
      listType = 'bulleted-list';
      if (bulletsCommand[1]?.trim()) {
        listBuffer.push(bulletsCommand[1].trim());
      }
      return;
    }

    if (numberedCommand) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'numbered-list') {
        flushList();
      }
      listType = 'numbered-list';
      if (numberedCommand[1]?.trim()) {
        listBuffer.push(numberedCommand[1].trim());
      }
      return;
    }

    if (bulletMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'bulleted-list') {
        flushList();
      }
      listType = 'bulleted-list';
      listBuffer.push(bulletMatch[1].trim());
      return;
    }

    if (numberedMatch) {
      flushParagraph();
      flushQuote();
      if (listType && listType !== 'numbered-list') {
        flushList();
      }
      listType = 'numbered-list';
      listBuffer.push(numberedMatch[1].trim());
      return;
    }

    if (paragraphCommand) {
      flushList();
      flushQuote();
      paragraphBuffer.push(paragraphCommand[1] ?? '');
      return;
    }

    flushList();
    flushQuote();
    paragraphBuffer.push(line);
  });

  flushAll();

  return prepareNotebookSections([...nonCaseFileSections, ...parsedSections]);
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
