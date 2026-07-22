import { useMemo, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Dossier, DossierSection } from '../types/dossierTypes';
import {
  getCaseFileBlockType,
  getCaseFileSections,
  type CaseFileDocumentDraft,
  type CaseFileDocumentLineFormat,
} from '../utils/dossierBlocks';
import type { EvidenceRecord } from '../../threadmarks/evidenceRecordTypes';
import { ThreadmarkSuggestionMenu } from '../../threadmarks/ThreadmarkSuggestionMenu';
import { useThreadmarkAuthoring } from '../../threadmarks/useThreadmarkAuthoring';

type CaseFileDocumentEditorProps = {
  draft: CaseFileDocumentDraft;
  dossier: Dossier;
  sections: DossierSection[];
  dossiers: Dossier[];
  evidenceRecords: EvidenceRecord[];
  onChange: (draft: CaseFileDocumentDraft) => void;
  onCreateEvidenceRecord: (details: {
    targetDossier: Dossier;
    originSectionId: string;
    selectedText: string;
    anchorStart: number;
    anchorEnd: number;
    originText: string;
  }) => Promise<void>;
  onNotice?: (message: string) => void;
};

type SlashCommand = {
  label: string;
  format: CaseFileDocumentLineFormat;
  replacement: string;
};

const slashCommands: SlashCommand[] = [
  { label: 'Heading', format: 'heading', replacement: '' },
  { label: 'Paragraph', format: 'paragraph', replacement: '' },
  { label: 'Bulleted List', format: 'paragraph', replacement: '- ' },
  { label: 'Numbered List', format: 'paragraph', replacement: '1. ' },
  { label: 'Quote', format: 'quote', replacement: '' },
  { label: 'Divider', format: 'divider', replacement: '---' },
];

function getLineIndex(text: string, position: number) {
  return text.slice(0, position).split('\n').length - 1;
}

function getLineBounds(text: string, position: number) {
  const lineStart = text.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const lineEndIndex = text.indexOf('\n', position);

  return {
    lineStart,
    lineEnd: lineEndIndex === -1 ? text.length : lineEndIndex,
  };
}

function replaceLine(text: string, position: number, replacement: string) {
  const { lineStart, lineEnd } = getLineBounds(text, position);

  return {
    text: `${text.slice(0, lineStart)}${replacement}${text.slice(lineEnd)}`,
    caret: lineStart + replacement.length,
  };
}

function lineStartsWithSlash(text: string, position: number) {
  const { lineStart, lineEnd } = getLineBounds(text, position);
  const line = text.slice(lineStart, lineEnd);

  return line === '/' || line.startsWith('/');
}

type DraftSectionRange = {
  section: DossierSection;
  start: number;
  end: number;
  bodyStart: number;
  bodyEnd: number;
  body: string;
};

function createDraftSectionRanges(draft: CaseFileDocumentDraft, sections: DossierSection[]): DraftSectionRange[] {
  const existingSections = getCaseFileSections(sections);
  const ranges: DraftSectionRange[] = [];
  const lines = draft.text.replace(/\r\n?/g, '\n').split('\n');
  let offset = 0;
  let existingCursor = 0;
  let blockStart = 0;
  let blockLines: string[] = [];
  let blockType: ReturnType<typeof getCaseFileBlockType> = null;

  function nextSection() {
    const section = existingSections[existingCursor];
    existingCursor += 1;
    return section;
  }

  function flush(endOffset: number) {
    if (!blockType || blockType === 'divider' || !blockLines.some((line) => line.trim())) {
      blockLines = [];
      blockType = null;
      blockStart = endOffset;
      return;
    }

    const section = nextSection();

    if (section) {
      const body = blockLines.join('\n').trimEnd();
      ranges.push({
        section,
        start: blockStart,
        end: endOffset,
        bodyStart: blockStart,
        bodyEnd: blockStart + body.length,
        body,
      });
    }

    blockLines = [];
    blockType = null;
    blockStart = endOffset;
  }

  lines.forEach((rawLine, index) => {
    const lineStart = offset;
    const lineEnd = lineStart + rawLine.length;
    const line = rawLine.trimEnd();
    const trimmedLine = line.trim();
    const format = draft.lineFormats[index];
    const nextOffset = lineEnd + 1;

    if (!trimmedLine) {
      flush(lineStart);
      blockStart = nextOffset;
      offset = nextOffset;
      return;
    }

    const lineType =
      format === 'heading'
        ? 'section-heading'
        : format === 'quote'
          ? 'quote'
          : format === 'divider' || trimmedLine === '---'
            ? 'divider'
            : /^\s*-\s+/.test(line)
              ? 'bulleted-list'
              : /^\s*\d+[.)]\s+/.test(line)
                ? 'numbered-list'
                : 'paragraph';

    if (lineType === 'divider') {
      flush(lineStart);
      nextSection();
      blockStart = nextOffset;
      offset = nextOffset;
      return;
    }

    if (blockType && blockType !== lineType) {
      flush(lineStart);
    }

    if (!blockType) {
      blockType = lineType;
      blockStart = lineStart;
    }

    blockLines.push(line.replace(/^\s*-\s+/, '').replace(/^\s*\d+[.)]\s+/, ''));
    offset = nextOffset;
  });

  flush(draft.text.length);
  return ranges;
}

function mapSelectionToSection(
  draft: CaseFileDocumentDraft,
  sections: DossierSection[],
  selectionStart: number,
  selectionEnd: number,
) {
  const selectionText = draft.text.slice(selectionStart, selectionEnd);

  if (!selectionText.trim()) {
    return null;
  }

  return createDraftSectionRanges(draft, sections).find(
    (range) => selectionStart >= range.bodyStart && selectionEnd <= range.bodyEnd,
  ) ?? null;
}

export function CaseFileDocumentEditor({
  draft,
  dossier,
  sections,
  dossiers,
  onChange,
  onCreateEvidenceRecord,
  onNotice,
}: CaseFileDocumentEditorProps) {
  const [slashLineIndex, setSlashLineIndex] = useState<number | null>(null);
  const [highlightedCommandIndex, setHighlightedCommandIndex] = useState(0);
  const lineCount = useMemo(() => draft.text.split('\n').length, [draft.text]);

  function updateDraft(text: string, lineFormats = draft.lineFormats) {
    onChange({ text, lineFormats });
  }

  const editorId = `case-file-document-editor-${dossier.id}`;
  const threadmarkMenuId = `${editorId}-threadmarks`;
  const {
    textareaRef: editorRef,
    authoringState,
    suggestions: threadmarkSuggestions,
    highlightedSuggestionIndex,
    updateAuthoringFromCursor,
    selectSuggestion,
    handleKeyDown: handleThreadmarkKeyDown,
  } = useThreadmarkAuthoring({
    editorId,
    dossier,
    sectionId: 'case-file-canvas',
    value: draft.text,
    dossiers,
    onChange: (text) => updateDraft(text),
    onCreateEvidenceRecord: async (targetDossier, selectionRange) => {
      const range = mapSelectionToSection(draft, sections, selectionRange.start, selectionRange.end);

      if (!range) {
        onNotice?.('Select text inside one section to create a Threadmark.');
        throw new Error('Select text inside one section to create a Threadmark.');
      }

      await onCreateEvidenceRecord({
        targetDossier,
        originSectionId: range.section.id,
        selectedText: draft.text.slice(selectionRange.start, selectionRange.end),
        anchorStart: selectionRange.start - range.bodyStart,
        anchorEnd: selectionRange.end - range.bodyStart,
        originText: range.body,
      });
    },
    onAuthoringNotice: onNotice,
  });

  function selectCommand(command: SlashCommand) {
    const editor = editorRef.current;

    if (!editor || slashLineIndex === null) {
      return;
    }

    const replacement = replaceLine(draft.text, editor.selectionStart, command.replacement);
    const nextLineFormats = {
      ...draft.lineFormats,
      [slashLineIndex]: command.format,
    };

    if (command.format === 'paragraph') {
      delete nextLineFormats[slashLineIndex];
    }

    updateDraft(replacement.text, nextLineFormats);
    setSlashLineIndex(null);
    setHighlightedCommandIndex(0);
    window.setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(replacement.caret, replacement.caret);
    }, 0);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const text = event.target.value;
    const lineIndex = getLineIndex(text, event.target.selectionStart);

    updateDraft(text);
    window.setTimeout(() => {
      updateAuthoringFromCursor(
        event.target.selectionStart,
        event.target.selectionEnd,
        'typing',
      );
    }, 0);

    if (lineStartsWithSlash(text, event.target.selectionStart)) {
      setSlashLineIndex(lineIndex);
      setHighlightedCommandIndex(0);
    } else {
      setSlashLineIndex(null);
      setHighlightedCommandIndex(0);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    handleThreadmarkKeyDown(event);

    if (event.defaultPrevented) {
      return;
    }

    if (slashLineIndex === null) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedCommandIndex((currentIndex) =>
        event.key === 'ArrowDown'
          ? (currentIndex + 1) % slashCommands.length
          : (currentIndex - 1 + slashCommands.length) % slashCommands.length,
      );
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashLineIndex(null);
      setHighlightedCommandIndex(0);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      selectCommand(slashCommands[highlightedCommandIndex]);
    }
  }

  return (
    <div className="case-file-document-editor">
      <textarea
        ref={editorRef}
        id={editorId}
        className="case-file-document-editor__surface"
        aria-label="Case File document"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={authoringState.isMenuOpen}
        aria-controls={authoringState.isMenuOpen ? threadmarkMenuId : undefined}
        aria-activedescendant={
          authoringState.isMenuOpen && threadmarkSuggestions[highlightedSuggestionIndex]
            ? `${threadmarkMenuId}-option-${highlightedSuggestionIndex}`
            : undefined
        }
        placeholder="Begin documenting..."
        rows={Math.max(8, Math.min(28, lineCount + 2))}
        value={draft.text}
        onChange={handleChange}
        onClick={(event) =>
          updateAuthoringFromCursor(
            event.currentTarget.selectionStart,
            event.currentTarget.selectionEnd,
            'cursor',
          )
        }
        onKeyUp={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
            return;
          }

          updateAuthoringFromCursor(
            event.currentTarget.selectionStart,
            event.currentTarget.selectionEnd,
            'typing',
          );
        }}
        onKeyDown={handleKeyDown}
      />
      {authoringState.isMenuOpen && authoringState.menuMode ? (
        <ThreadmarkSuggestionMenu
          id={threadmarkMenuId}
          mode={authoringState.menuMode}
          suggestions={threadmarkSuggestions}
          highlightedIndex={highlightedSuggestionIndex}
          isMobile={false}
          onSelect={selectSuggestion}
        />
      ) : null}
      {slashLineIndex !== null ? (
        <div className="case-file-document-editor__slash-menu" role="listbox" aria-label="Case File commands">
          {slashCommands.map((command, index) => (
            <button
              key={command.label}
              type="button"
              role="option"
              aria-selected={highlightedCommandIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectCommand(command)}
            >
              {command.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
