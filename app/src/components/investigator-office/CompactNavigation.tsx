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
};

export function CompactNavigation({
  activeSection,
  hasActiveCase,
  onOpenCaseArchive,
  onSelectSection,
}: CompactNavigationProps) {
  return (
    <nav className="compact-navigation" aria-label="Primary navigation">
      <details className="compact-navigation__details">
        <summary className="compact-navigation__summary">Navigate</summary>
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
                    return;
                  }

                  if (isInvestigationSection(item.label)) {
                    onSelectSection(item.label);
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
                {item.label}
              </button>
            );
          })}
        </div>
      </details>
    </nav>
  );
}
