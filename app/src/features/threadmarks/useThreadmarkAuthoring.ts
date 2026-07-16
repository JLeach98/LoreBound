import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { Dossier, DossierType } from '../cases/types/dossierTypes';
import {
  getThreadmarkDefinition,
} from './threadmarkSelectors';
import {
  getThreadmarkParseResultAtOffset,
  parseThreadmarks,
} from './threadmarkParser';
import {
  updateThreadmarkAuthoringDiagnostics,
} from './threadmarkAutocomplete';
import type {
  ThreadmarkAuthoringState,
  ThreadmarkAuthoringSuggestion,
} from './threadmarkAuthoringTypes';
import { getRelationshipSuggestions, getTargetDossierSuggestions } from './threadmarkSuggestionEngine';
import { replaceThreadmarkTextRange } from './threadmarkTextInsertion';

const closedRange = Object.freeze({ start: 0, end: 0 });

function createIdleState({
  editorId,
  dossierId,
  sectionId,
  sourceKnowledgeType,
}: {
  editorId: string;
  dossierId: string;
  sectionId: string;
  sourceKnowledgeType: DossierType;
}): ThreadmarkAuthoringState {
  return Object.freeze({
    state: 'idle',
    editorId,
    dossierId,
    sectionId,
    sourceKnowledgeType,
    cursorOffset: 0,
    selectionRange: closedRange,
    activeRelationshipFragment: '',
    activeTargetFragment: '',
    replacementRange: closedRange,
    highlightedSuggestionIndex: 0,
    triggerOrigin: 'cursor',
    isMenuOpen: false,
  });
}

function getRelationshipFragmentBeforeCursor(value: string, cursorOffset: number) {
  const beforeCursor = value.slice(0, cursorOffset);
  const match = /(?:^|[\s([{'"`])@([A-Za-z0-9_-]*)$/u.exec(beforeCursor);

  if (!match || typeof match.index !== 'number') {
    return null;
  }

  return {
    fragment: match[1],
    range: {
      start: beforeCursor.lastIndexOf('@'),
      end: cursorOffset,
    },
  };
}

function getTargetFragmentFromParse(value: string, cursorOffset: number) {
  const parseResults = parseThreadmarks(value, { includeInvalid: true, includeIncomplete: true });
  const activeResult = getThreadmarkParseResultAtOffset(parseResults, cursorOffset);

  if (!activeResult?.canonicalKey || !activeResult.targetToken) {
    return null;
  }

  const targetStart = activeResult.rawText.lastIndexOf('@');
  const absoluteTargetStart = activeResult.startOffset + targetStart + 1;

  if (cursorOffset < absoluteTargetStart) {
    return null;
  }

  return {
    canonicalKey: activeResult.canonicalKey,
    fragment: value.slice(absoluteTargetStart, cursorOffset),
    range: {
      start: absoluteTargetStart,
      end: activeResult.endOffset,
    },
  };
}

export function useThreadmarkAuthoring({
  editorId,
  dossier,
  sectionId,
  value,
  dossiers,
  onChange,
  isMobile = false,
}: {
  editorId: string;
  dossier: Dossier;
  sectionId: string;
  value: string;
  dossiers: readonly Dossier[];
  onChange: (value: string) => void;
  isMobile?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [authoringState, setAuthoringState] = useState<ThreadmarkAuthoringState>(() =>
    createIdleState({
      editorId,
      dossierId: dossier.id,
      sectionId,
      sourceKnowledgeType: dossier.dossierType,
    }),
  );
  const [insertionFailureCount, setInsertionFailureCount] = useState(0);
  const [selectionInserted, setSelectionInserted] = useState(false);

  function closeSuggestions(nextState: ThreadmarkAuthoringState['state'] = 'dismissed') {
    setAuthoringState((current) =>
      Object.freeze({
        ...current,
        state: nextState,
        isMenuOpen: false,
        menuMode: undefined,
        highlightedSuggestionIndex: 0,
      }),
    );
  }

  function updateAuthoringFromCursor(
    cursorOffset: number,
    selectionEnd = cursorOffset,
    triggerOrigin: ThreadmarkAuthoringState['triggerOrigin'] = 'cursor',
  ) {
    try {
      const relationshipContext = getRelationshipFragmentBeforeCursor(value, cursorOffset);

      if (relationshipContext) {
        setAuthoringState(
          Object.freeze({
            state: 'relationshipSearch',
            editorId,
            dossierId: dossier.id,
            sectionId,
            sourceKnowledgeType: dossier.dossierType,
            cursorOffset,
            selectionRange: { start: cursorOffset, end: selectionEnd },
            activeRelationshipFragment: relationshipContext.fragment,
            activeTargetFragment: '',
            replacementRange: relationshipContext.range,
            highlightedSuggestionIndex: 0,
            triggerOrigin,
            menuMode: 'relationship',
            isMenuOpen: true,
          }),
        );
        return;
      }

      const targetContext = getTargetFragmentFromParse(value, cursorOffset);

      if (targetContext) {
        setAuthoringState(
          Object.freeze({
            state: 'targetSearch',
            editorId,
            dossierId: dossier.id,
            sectionId,
            sourceKnowledgeType: dossier.dossierType,
            cursorOffset,
            selectionRange: { start: cursorOffset, end: selectionEnd },
            activeRelationshipFragment: '',
            canonicalRelationshipKey: targetContext.canonicalKey,
            activeTargetFragment: targetContext.fragment,
            replacementRange: targetContext.range,
            highlightedSuggestionIndex: 0,
            triggerOrigin,
            menuMode: 'target',
            isMenuOpen: true,
          }),
        );
        return;
      }

      closeSuggestions('idle');
    } catch (error) {
      console.warn('Threadmark authoring disabled for current interaction.', error);
      closeSuggestions('invalidContext');
    }
  }

  function focusAndMoveCursor(offset: number) {
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(offset, offset);
      updateAuthoringFromCursor(offset, offset, 'selection');
    }, 0);
  }

  const relationshipSuggestions = useMemo(
    () =>
      authoringState.menuMode === 'relationship'
        ? getRelationshipSuggestions({
            query: authoringState.activeRelationshipFragment,
            sourceKnowledgeType: dossier.dossierType,
          })
        : Object.freeze([]),
    [authoringState.activeRelationshipFragment, authoringState.menuMode, dossier.dossierType],
  );

  const targetSearch = useMemo(() => {
    if (authoringState.menuMode !== 'target' || !authoringState.canonicalRelationshipKey) {
      return Object.freeze({ results: Object.freeze([]), durationMs: 0 });
    }

    const definition = getThreadmarkDefinition(authoringState.canonicalRelationshipKey);

    if (!definition) {
      return Object.freeze({ results: Object.freeze([]), durationMs: 0 });
    }

    return getTargetDossierSuggestions({
      query: authoringState.activeTargetFragment,
      dossiers,
      sourceDossierId: dossier.id,
      validTargetTypes: definition.validTargetTypes,
    });
  }, [
    authoringState.activeTargetFragment,
    authoringState.canonicalRelationshipKey,
    authoringState.menuMode,
    dossier.id,
    dossiers,
  ]);

  const suggestions: readonly ThreadmarkAuthoringSuggestion[] =
    authoringState.menuMode === 'relationship'
      ? relationshipSuggestions
      : targetSearch.results;

  updateThreadmarkAuthoringDiagnostics({
    activeState: authoringState.state,
    relationshipMenuOpen: authoringState.menuMode === 'relationship' && authoringState.isMenuOpen,
    targetMenuOpen: authoringState.menuMode === 'target' && authoringState.isMenuOpen,
    currentSourceKnowledgeType: dossier.dossierType,
    relationshipSuggestionCount: relationshipSuggestions.length,
    targetSuggestionCount: targetSearch.results.length,
    selectionInserted,
    insertionFailureCount,
    targetSearchDurationMs: targetSearch.durationMs,
    mobileSheetActive: isMobile && authoringState.isMenuOpen,
    desktopAnchorActive: !isMobile && authoringState.isMenuOpen,
  });

  function selectSuggestion(suggestion: ThreadmarkAuthoringSuggestion) {
    try {
      if (suggestion.kind === 'relationship') {
        const insertion = `@${suggestion.definition.key} @`;
        const result = replaceThreadmarkTextRange(value, authoringState.replacementRange, insertion);
        onChange(result.value);
        setSelectionInserted(true);
        setAuthoringState((current) =>
          Object.freeze({
            ...current,
            state: 'targetSearch',
            canonicalRelationshipKey: suggestion.definition.key,
            activeRelationshipFragment: '',
            activeTargetFragment: '',
            replacementRange: { start: result.cursorOffset, end: result.cursorOffset },
            cursorOffset: result.cursorOffset,
            selectionRange: { start: result.cursorOffset, end: result.cursorOffset },
            highlightedSuggestionIndex: 0,
            menuMode: 'target',
            isMenuOpen: true,
          }),
        );
        focusAndMoveCursor(result.cursorOffset);
        return;
      }

      const result = replaceThreadmarkTextRange(
        value,
        authoringState.replacementRange,
        suggestion.name,
      );
      onChange(result.value);
      setSelectionInserted(true);
      closeSuggestions('complete');
      focusAndMoveCursor(result.cursorOffset);
    } catch (error) {
      console.warn('Threadmark insertion failed.', error);
      setInsertionFailureCount((count) => count + 1);
      closeSuggestions('invalidContext');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!authoringState.isMenuOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSuggestions();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setAuthoringState((current) =>
        Object.freeze({
          ...current,
          highlightedSuggestionIndex:
            suggestions.length === 0
              ? 0
              : event.key === 'ArrowDown'
                ? (current.highlightedSuggestionIndex + 1) % suggestions.length
                : (current.highlightedSuggestionIndex - 1 + suggestions.length) % suggestions.length,
        }),
      );
      return;
    }

    if (event.key === 'Enter' && suggestions[authoringState.highlightedSuggestionIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[authoringState.highlightedSuggestionIndex]);
    }
  }

  return {
    textareaRef: textareaRef as RefObject<HTMLTextAreaElement>,
    authoringState,
    suggestions,
    highlightedSuggestionIndex: authoringState.highlightedSuggestionIndex,
    updateAuthoringFromCursor,
    closeSuggestions,
    selectSuggestion,
    handleKeyDown,
  };
}
