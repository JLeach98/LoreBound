const navigationItems = [
  { label: 'Case Archive', marker: 'CA', status: 'available' },
  { label: 'Board', marker: 'BD', status: 'active' },
  { label: 'Characters', marker: 'CH', status: 'disabled' },
  { label: 'Locations', marker: 'LO', status: 'disabled' },
  { label: 'Events', marker: 'EV', status: 'disabled' },
  { label: 'Organizations', marker: 'OR', status: 'disabled' },
  { label: 'Theories', marker: 'TH', status: 'disabled' },
  { label: 'Timeline', marker: 'TL', status: 'disabled' },
  { label: 'Case Settings', marker: 'CS', status: 'disabled' },
];

type CompactNavigationProps = {
  onOpenCaseArchive: () => void;
};

export function CompactNavigation({ onOpenCaseArchive }: CompactNavigationProps) {
  return (
    <nav className="compact-navigation" aria-label="Primary navigation">
      <details className="compact-navigation__details">
        <summary className="compact-navigation__summary">Navigate</summary>
        <div className="compact-navigation__items">
          {navigationItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className="compact-navigation__item"
            onClick={item.label === 'Case Archive' ? onOpenCaseArchive : undefined}
            aria-current={item.status === 'active' ? 'page' : undefined}
              disabled={item.status === 'disabled'}
              title={
                item.status === 'disabled'
                  ? `${item.label} is unavailable until a case is open`
                  : item.label
              }
              data-active={item.status === 'active' ? 'true' : 'false'}
            >
              <span aria-hidden="true">{item.marker}</span>
              {item.label}
            </button>
          ))}
        </div>
      </details>
    </nav>
  );
}
