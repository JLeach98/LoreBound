import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { dossierTypes, type Dossier, type DossierType } from '../cases/types/dossierTypes';
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
  ThreadmarkTargetSuggestion,
} from './threadmarkAuthoringTypes';
import { getRelationshipSuggestions, getTargetDossierSuggestions } from './threadmarkSuggestionEngine';
import { replaceThreadmarkTextRange } from './threadmarkTextInsertion';

const closedRange = Object.freeze({ start: 0, end: 0 });

function getTextareaCaretAnchor(textarea: HTMLTextAreaElement, value: string, offset: number) {
  const computedStyle = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const styleProperties = [
    'boxSizing',
    'width',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'textTransform',
    'wordSpacing',
    'lineHeight',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'whiteSpace',
    'wordBreak',
    'overflowWrap',
    'tabSize',
  ] as const;

  styleProperties.forEach((property) => {
    mirror.style[property] = computedStyle[property];
  });

  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow = 'hidden';
  mirror.style.minHeight = '0';
  mirror.style.height = 'auto';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.textContent = value.slice(0, offset);
  marker.textContent = value.slice(offset, offset + 1) || '\u200b';
  mirror.append(marker);
  document.body.append(mirror);

  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || Number.parseFloat(computedStyle.fontSize) * 1.4;
  const anchor = {
    left: Math.min(textarea.clientWidth - 12, Math.max(0, marker.offsetLeft - textarea.scrollLeft)),
    top: Math.max(0, marker.offsetTop - textarea.scrollTop + lineHeight + 6),
  };

  mirror.remove();
  return anchor;
}

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

  if (activeResult.status === 'valid' && cursorOffset >= activeResult.endOffset) {
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
  onCreateEvidenceRecord,
  onAuthoringNotice,
  isMobile = false,
}: {
  editorId: string;
  dossier: Dossier;
  sectionId: string;
  value: string;
  dossiers: readonly Dossier[];
  onChange: (value: string) => void;
  onCreateEvidenceRecord?: (targetDossier: Dossier, selectionRange: { start: number; end: number }) => Promise<void> | void;
  onAuthoringNotice?: (message: string) => void;
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
  const [menuAnchorPosition, setMenuAnchorPosition] = useState<{ left: number; top: number } | undefined>();
  const [insertionFailureCount, setInsertionFailureCount] = useState(0);
  const [selectionInserted, setSelectionInserted] = useState(false);

  function updateMenuAnchorPosition(cursorOffset: number) {
    if (isMobile) {
      setMenuAnchorPosition(undefined);
      return;
    }

    const textarea = textareaRef.current;

    if (!textarea) {
      setMenuAnchorPosition(undefined);
      return;
    }

    setMenuAnchorPosition(getTextareaCaretAnchor(textarea, value, cursorOffset));
  }

  function closeSuggestions(nextState: ThreadmarkAuthoringState['state'] = 'dismissed') {
    setMenuAnchorPosition(undefined);
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
      const selectedText = value.slice(cursorOffset, selectionEnd);

      if (onCreateEvidenceRecord && selectionEnd > cursorOffset && selectedText.trim()) {
        updateMenuAnchorPosition(selectionEnd);
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
            activeTargetFragment: '',
            replacementRange: { start: cursorOffset, end: selectionEnd },
            highlightedSuggestionIndex: 0,
            triggerOrigin,
            menuMode: 'target',
            isMenuOpen: true,
          }),
        );
        return;
      }

      const relationshipContext = getRelationshipFragmentBeforeCursor(value, cursorOffset);

      if (relationshipContext) {
        updateMenuAnchorPosition(cursorOffset);
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
        updateMenuAnchorPosition(cursorOffset);
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
    if (authoringState.menuMode !== 'target') {
      return Object.freeze({ results: Object.freeze([]), durationMs: 0 });
    }

    if (!authoringState.canonicalRelationshipKey && onCreateEvidenceRecord) {
      return getTargetDossierSuggestions({
        query: authoringState.activeTargetFragment,
        dossiers: dossiers.filter((candidate) => candidate.caseId === dossier.caseId),
        sourceDossierId: dossier.id,
        validTargetTypes: dossierTypes,
      });
    }

    if (!authoringState.canonicalRelationshipKey) {
      return Object.freeze({ results: Object.freeze([]), durationMs: 0 });
    }

    const definition = getThreadmarkDefinition(authoringState.canonicalRelationshipKey);

    if (!definition) {
      return Object.freeze({ results: Object.freeze([]), durationMs: 0 });
    }

    return getTargetDossierSuggestions({
      query: authoringState.activeTargetFragment,
      dossiers: dossiers.filter((candidate) => candidate.caseId === dossier.caseId),
      sourceDossierId: dossier.id,
      validTargetTypes: definition.validTargetTypes,
    });
  }, [
    authoringState.activeTargetFragment,
    authoringState.canonicalRelationshipKey,
    authoringState.menuMode,
    dossier.id,
    dossier.caseId,
    dossiers,
    onCreateEvidenceRecord,
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
        setMenuAnchorPosition(
          textareaRef.current ? getTextareaCaretAnchor(textareaRef.current, result.value, result.cursorOffset) : undefined,
        );
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

      if (onCreateEvidenceRecord && suggestion.kind === 'target' && !authoringState.canonicalRelationshipKey) {
        void Promise.resolve(
          onCreateEvidenceRecord(
            (suggestion as ThreadmarkTargetSuggestion).dossier,
            authoringState.selectionRange,
          ),
        )
          .then(() => {
            setSelectionInserted(true);
            closeSuggestions('complete');
            window.setTimeout(() => textareaRef.current?.focus(), 0);
          })
          .catch((error) => {
            console.warn('Threadmark Evidence Record creation failed.', error);
            onAuthoringNotice?.(
              error instanceof Error && error.message.trim()
                ? error.message
                : 'Threadmark could not be created.',
            );
            setInsertionFailureCount((count) => count + 1);
            closeSuggestions('invalidContext');
          });
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

    if (onCreateEvidenceRecord && authoringState.menuMode === 'target' && !authoringState.canonicalRelationshipKey) {
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setAuthoringState((current) =>
          Object.freeze({
            ...current,
            activeTargetFragment: `${current.activeTargetFragment}${event.key}`,
            highlightedSuggestionIndex: 0,
          }),
        );
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        setAuthoringState((current) =>
          Object.freeze({
            ...current,
            activeTargetFragment: current.activeTargetFragment.slice(0, -1),
            highlightedSuggestionIndex: 0,
          }),
        );
        return;
      }
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
    menuAnchorPosition,
    updateAuthoringFromCursor,
    closeSuggestions,
    selectSuggestion,
    handleKeyDown,
  };
}
