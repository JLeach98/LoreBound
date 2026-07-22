import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Dossier, DossierSection } from '../types/dossierTypes';
import {
  getCaseFileBlockType,
  getCaseFileSections,
  type CaseFileDocumentDraft,
  type CaseFileDocumentLineFormat,
} from '../utils/dossierBlocks';
import type { EvidenceRecord } from '../../threadmarks/evidenceRecordTypes';
import { ThreadmarkSuggestionMenu } from '../../threadmarks/ThreadmarkSuggestionMenu';
import type { ThreadmarkTargetSuggestion } from '../../threadmarks/threadmarkAuthoringTypes';
import { getTargetDossierSuggestions } from '../../threadmarks/threadmarkSuggestionEngine';

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
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [slashLineIndex, setSlashLineIndex] = useState<number | null>(null);
  const [highlightedCommandIndex, setHighlightedCommandIndex] = useState(0);
  const [threadmarkSelection, setThreadmarkSelection] = useState<{
    start: number;
    end: number;
    range: DraftSectionRange;
    query: string;
    highlightedIndex: number;
  } | null>(null);
  const lineCount = useMemo(() => draft.text.split('\n').length, [draft.text]);
  const threadmarkSuggestions = useMemo(
    () =>
      threadmarkSelection
        ? getTargetDossierSuggestions({
            query: threadmarkSelection.query,
            dossiers: dossiers.filter((candidate) => candidate.caseId === dossier.caseId),
            sourceDossierId: dossier.id,
            validTargetTypes: ['Character', 'Location', 'Event', 'Organization', 'Theory', 'Artifact'],
          }).results
        : [],
    [dossier.caseId, dossier.id, dossiers, threadmarkSelection],
  );

  function updateDraft(text: string, lineFormats = draft.lineFormats) {
    onChange({ text, lineFormats });
  }

  function updateThreadmarkSelection(selectionStart: number, selectionEnd: number) {
    if (selectionEnd <= selectionStart) {
      setThreadmarkSelection(null);
      return;
    }

    const range = mapSelectionToSection(draft, sections, selectionStart, selectionEnd);

    if (!range) {
      onNotice?.('Select text inside one section to create a Threadmark.');
      setThreadmarkSelection(null);
      return;
    }

    setThreadmarkSelection({ start: selectionStart, end: selectionEnd, range, query: '', highlightedIndex: 0 });
  }

  function selectThreadmarkTarget(suggestion: ThreadmarkTargetSuggestion) {
    if (!threadmarkSelection) {
      return;
    }

    const selectedText = draft.text.slice(threadmarkSelection.start, threadmarkSelection.end);
    const anchorStart = threadmarkSelection.start - threadmarkSelection.range.bodyStart;
    const anchorEnd = threadmarkSelection.end - threadmarkSelection.range.bodyStart;

    void onCreateEvidenceRecord({
      targetDossier: suggestion.dossier,
      originSectionId: threadmarkSelection.range.section.id,
      selectedText,
      anchorStart,
      anchorEnd,
      originText: threadmarkSelection.range.body,
    })
      .then(() => {
        setThreadmarkSelection(null);
        window.setTimeout(() => editorRef.current?.focus(), 0);
      })
      .catch((error) => {
        onNotice?.(error instanceof Error ? error.message : 'Threadmark could not be created.');
      });
  }

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
    setThreadmarkSelection(null);

    if (lineStartsWithSlash(text, event.target.selectionStart)) {
      setSlashLineIndex(lineIndex);
      setHighlightedCommandIndex(0);
    } else {
      setSlashLineIndex(null);
      setHighlightedCommandIndex(0);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (threadmarkSelection) {
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setThreadmarkSelection((current) =>
          current ? { ...current, query: `${current.query}${event.key}`, highlightedIndex: 0 } : current,
        );
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        setThreadmarkSelection((current) =>
          current ? { ...current, query: current.query.slice(0, -1), highlightedIndex: 0 } : current,
        );
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setThreadmarkSelection(null);
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setThreadmarkSelection((current) =>
          current
            ? {
                ...current,
                highlightedIndex:
                  threadmarkSuggestions.length === 0
                    ? 0
                    : event.key === 'ArrowDown'
                      ? (current.highlightedIndex + 1) % threadmarkSuggestions.length
                      : (current.highlightedIndex - 1 + threadmarkSuggestions.length) % threadmarkSuggestions.length,
              }
            : current,
        );
        return;
      }

      if (event.key === 'Enter' && threadmarkSuggestions[threadmarkSelection.highlightedIndex]) {
        event.preventDefault();
        selectThreadmarkTarget(threadmarkSuggestions[threadmarkSelection.highlightedIndex]);
        return;
      }
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
        className="case-file-document-editor__surface"
        aria-label="Case File document"
        placeholder="Begin documenting..."
        rows={Math.max(8, Math.min(28, lineCount + 2))}
        value={draft.text}
        onChange={handleChange}
        onClick={(event) =>
          updateThreadmarkSelection(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
        }
        onKeyUp={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
            return;
          }

          updateThreadmarkSelection(event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
        }}
        onKeyDown={handleKeyDown}
      />
      {threadmarkSelection ? (
        <ThreadmarkSuggestionMenu
          id="case-file-threadmark-targets"
          mode="target"
          suggestions={threadmarkSuggestions}
          highlightedIndex={threadmarkSelection.highlightedIndex}
          isMobile={false}
          onSelect={(suggestion) => {
            if (suggestion.kind === 'target') {
              selectThreadmarkTarget(suggestion);
            }
          }}
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
