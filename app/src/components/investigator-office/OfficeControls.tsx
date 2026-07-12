import { Button } from '../ui/Button';

export function OfficeControls() {
  return (
    <div className="office-controls" aria-label="Office controls">
      <Button type="button" variant="brass">
        Archive Search
      </Button>
      <Button type="button" variant="plaque" aria-label="Open settings">
        Settings
      </Button>
    </div>
  );
}
