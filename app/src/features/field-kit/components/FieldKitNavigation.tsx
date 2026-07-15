export type FieldKitDestination = 'home' | 'dossiers' | 'board' | 'more';

type FieldKitNavigationProps = {
  activeDestination: FieldKitDestination;
  onNavigate: (destination: FieldKitDestination) => void;
};

const destinations: Array<{ id: FieldKitDestination; label: string; path: string }> = [
  { id: 'home', label: 'Field Kit', path: 'M4 7.5h16M6 7.5v12h12v-12M9 11h6' },
  { id: 'dossiers', label: 'Dossiers', path: 'M5 4.5h9l5 5v10H5zM14 4.5v5h5M8 13h8M8 16h6' },
  { id: 'board', label: 'Board', path: 'M5 5h14v14H5zM8 8h3v3H8zM13 13h3v3h-3zM11 10l3 3' },
  { id: 'more', label: 'More', path: 'M5 12h.01M12 12h.01M19 12h.01' },
];

export function FieldKitNavigation({ activeDestination, onNavigate }: FieldKitNavigationProps) {
  return (
    <nav className="field-kit-nav" aria-label="Field Kit navigation">
      {destinations.map((destination) => (
        <button
          key={destination.id}
          type="button"
          className={activeDestination === destination.id ? 'field-kit-nav__item--active' : ''}
          aria-current={activeDestination === destination.id ? 'page' : undefined}
          onClick={() => onNavigate(destination.id)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d={destination.path} />
          </svg>
          <span>{destination.label}</span>
        </button>
      ))}
    </nav>
  );
}
