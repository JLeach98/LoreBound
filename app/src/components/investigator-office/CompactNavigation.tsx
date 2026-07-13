import { useEffect, useRef, useState } from 'react';
import type {
  InvestigationSection,
  NavigationSection,
} from '../../features/cases/types/investigationSections';
import { investigationSections } from '../../features/cases/types/investigationSections';

const navigationItems: Array<{ label: NavigationSection; marker: string }> = [
  { label: 'Case Archive', marker: 'CA' },
  { label: 'Board', marker: 'BD' },
  { label: 'Characters', marker: 'CH' },
  { label: 'Locations', marker: 'LO' },
  { label: 'Events', marker: 'EV' },
  { label: 'Organizations', marker: 'OR' },
  { label: 'Theories', marker: 'TH' },
  { label: 'Timeline', marker: 'TL' },
  { label: 'Case Settings', marker: 'CS' },
];

function isInvestigationSection(label: NavigationSection): label is InvestigationSection {
  return investigationSections.includes(label as InvestigationSection);
}

type CompactNavigationProps = {
  activeSection: InvestigationSection;
  hasActiveCase: boolean;
  onOpenCaseArchive: () => void;
  onSelectSection: (section: InvestigationSection) => void;
  onFocusBoard: () => void;
};

export function CompactNavigation({
  activeSection,
  hasActiveCase,
  onOpenCaseArchive,
  onSelectSection,
  onFocusBoard,
}: CompactNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        navigationRef.current &&
        event.target instanceof Node &&
        !navigationRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <nav ref={navigationRef} className="compact-navigation" aria-label="Primary navigation">
      <button
        ref={triggerRef}
        type="button"
        className="compact-navigation__trigger"
        aria-label="Navigation"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <span>Navigation</span>
      </button>
      {isOpen ? (
        <div className="compact-navigation__items">
          {navigationItems.map((item) => {
            const isArchive = item.label === 'Case Archive';
            const isDisabled = !isArchive && item.label !== 'Board' && !hasActiveCase;
            const isActive = !isArchive && item.label === activeSection;

            return (
              <button
                key={item.label}
                type="button"
                className="compact-navigation__item"
                onClick={() => {
                  if (isArchive) {
                    onOpenCaseArchive();
                    setIsOpen(false);
                    return;
                  }

                  if (item.label === 'Board' && hasActiveCase) {
                    onFocusBoard();
                    setIsOpen(false);
                    return;
                  }

                  if (isInvestigationSection(item.label)) {
                    onSelectSection(item.label);
                    setIsOpen(false);
                  }
                }}
                aria-current={isActive ? 'page' : undefined}
                disabled={isDisabled}
                title={
                  isDisabled
                    ? `${item.label} is unavailable until a case is open`
                    : item.label
                }
                data-active={isActive ? 'true' : 'false'}
              >
                <span aria-hidden="true">{item.marker}</span>
                {item.label === 'Board' ? 'Focus on Board' : item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
