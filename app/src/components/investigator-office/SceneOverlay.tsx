import { Button } from '../ui/Button';

export function SceneOverlay() {
  return (
    <section className="scene-overlay" aria-labelledby="scene-empty-heading">
      <p className="scene-overlay__eyebrow">Board</p>
      <h1 id="scene-empty-heading" className="font-display">
        No Active Investigation
      </h1>
      <p>Open or create a Case to begin.</p>
      <Button type="button" variant="brass" className="mt-4">
        Open Case Archive
      </Button>
    </section>
  );
}
