import type { ThreadmarkAuthoringMode, ThreadmarkAuthoringSuggestion } from './threadmarkAuthoringTypes';

export function ThreadmarkSuggestionMenu({
  id,
  mode,
  suggestions,
  highlightedIndex,
  isMobile,
  anchorPosition,
  onSelect,
}: {
  id: string;
  mode: ThreadmarkAuthoringMode;
  suggestions: readonly ThreadmarkAuthoringSuggestion[];
  highlightedIndex: number;
  isMobile: boolean;
  anchorPosition?: { left: number; top: number };
  onSelect: (suggestion: ThreadmarkAuthoringSuggestion) => void;
}) {
  const isAnchored = !isMobile && anchorPosition;

  return (
    <div
      id={id}
      className={`threadmark-menu ${
        isMobile
          ? 'threadmark-menu--mobile'
          : isAnchored
            ? 'threadmark-menu--desktop threadmark-menu--anchored'
            : 'threadmark-menu--desktop'
      }`}
      role="listbox"
      aria-label={mode === 'relationship' ? 'Relationship Threadmarks' : 'Dossier targets'}
      style={isAnchored ? { left: anchorPosition.left, top: anchorPosition.top } : undefined}
    >
      {suggestions.length ? (
        suggestions.map((suggestion, index) => {
          const isHighlighted = index === highlightedIndex;

          return (
            <button
              key={suggestion.id}
              id={`${id}-option-${index}`}
              type="button"
              className={`threadmark-menu__option${isHighlighted ? ' threadmark-menu__option--active' : ''}`}
              role="option"
              aria-selected={isHighlighted}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(suggestion)}
            >
              {suggestion.kind === 'relationship' ? (
                <>
                  <span className="threadmark-menu__title">{suggestion.displayName}</span>
                  <span className="threadmark-menu__meta">{suggestion.description}</span>
                  <span className="threadmark-menu__hint">{suggestion.targetTypeSummary}</span>
                </>
              ) : (
                <>
                  <span className="threadmark-menu__target">
                    {suggestion.dossier.coverImage ? (
                      <img src={suggestion.dossier.coverImage} alt="" />
                    ) : (
                      <span>{suggestion.initials}</span>
                    )}
                  </span>
                  <span className="threadmark-menu__target-copy">
                    <span className="threadmark-menu__title">{suggestion.name}</span>
                    <span className="threadmark-menu__meta">{suggestion.secondaryLine}</span>
                  </span>
                </>
              )}
            </button>
          );
        })
      ) : (
        <p className="threadmark-menu__empty" role="status">
          {mode === 'relationship' ? 'No matching Threadmarks found' : 'No matching Dossier found'}
        </p>
      )}
    </div>
  );
}
