import { useId, type ChangeEvent } from 'react';
import type { Dossier } from '../cases/types/dossierTypes';
import { ThreadmarkSuggestionMenu } from './ThreadmarkSuggestionMenu';
import { useThreadmarkAuthoring } from './useThreadmarkAuthoring';

export function ThreadmarkAuthoringTextarea({
  id,
  className,
  rows,
  value,
  dossier,
  sectionId,
  dossiers,
  isMobile = false,
  placeholder,
  onChange,
}: {
  id?: string;
  className?: string;
  rows: number;
  value: string;
  dossier: Dossier;
  sectionId: string;
  dossiers: readonly Dossier[];
  isMobile?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const generatedId = useId();
  const editorId = id ?? `threadmark-editor-${generatedId}`;
  const menuId = `${editorId}-threadmarks`;
  const {
    textareaRef,
    authoringState,
    suggestions,
    highlightedSuggestionIndex,
    updateAuthoringFromCursor,
    selectSuggestion,
    handleKeyDown,
  } = useThreadmarkAuthoring({
    editorId,
    dossier,
    sectionId,
    value,
    dossiers,
    onChange,
    isMobile,
  });

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
    window.setTimeout(() => {
      updateAuthoringFromCursor(
        event.target.selectionStart,
        event.target.selectionEnd,
        'typing',
      );
    }, 0);
  }

  return (
    <span className="threadmark-authoring">
      <textarea
        ref={textareaRef}
        id={editorId}
        className={className}
        rows={rows}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={authoringState.isMenuOpen}
        aria-controls={authoringState.isMenuOpen ? menuId : undefined}
        placeholder={placeholder}
        aria-activedescendant={
          authoringState.isMenuOpen && suggestions[highlightedSuggestionIndex]
            ? `${menuId}-option-${highlightedSuggestionIndex}`
            : undefined
        }
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
          id={menuId}
          mode={authoringState.menuMode}
          suggestions={suggestions}
          highlightedIndex={highlightedSuggestionIndex}
          isMobile={isMobile}
          onSelect={selectSuggestion}
        />
      ) : null}
    </span>
  );
}
