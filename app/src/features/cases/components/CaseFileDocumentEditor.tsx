import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { CaseFileDocumentDraft, CaseFileDocumentLineFormat } from '../utils/dossierBlocks';

type CaseFileDocumentEditorProps = {
  draft: CaseFileDocumentDraft;
  onChange: (draft: CaseFileDocumentDraft) => void;
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

export function CaseFileDocumentEditor({ draft, onChange }: CaseFileDocumentEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [slashLineIndex, setSlashLineIndex] = useState<number | null>(null);
  const [highlightedCommandIndex, setHighlightedCommandIndex] = useState(0);
  const lineCount = useMemo(() => draft.text.split('\n').length, [draft.text]);

  function updateDraft(text: string, lineFormats = draft.lineFormats) {
    onChange({ text, lineFormats });
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

    if (lineStartsWithSlash(text, event.target.selectionStart)) {
      setSlashLineIndex(lineIndex);
      setHighlightedCommandIndex(0);
    } else {
      setSlashLineIndex(null);
      setHighlightedCommandIndex(0);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
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
        onKeyDown={handleKeyDown}
      />
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
