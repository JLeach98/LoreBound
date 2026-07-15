import { useState } from 'react';
import { LoreBoundSettings } from '../../../components/application-shell/LoreBoundSettings';
import { DossierFormDialog } from '../../cases/components/DossierFormDialog';
import { useCases } from '../../cases/context/CaseContext';
import { useDossiers } from '../../cases/context/DossierContext';
import type { Dossier, DossierFormValues, DossierType } from '../../cases/types/dossierTypes';
import { FieldKitBoard } from './FieldKitBoard';
import { FieldKitDossiers } from './FieldKitDossiers';
import { FieldKitHeader } from './FieldKitHeader';
import { FieldKitHome } from './FieldKitHome';
import { FieldKitInvestigations } from './FieldKitInvestigations';
import { FieldKitMore } from './FieldKitMore';
import { FieldKitNavigation, type FieldKitDestination } from './FieldKitNavigation';
import { FieldKitQuickAdd } from './FieldKitQuickAdd';

export function FieldKitShell() {
  const { activeCase } = useCases();
  const { createNewDossier } = useDossiers();
  const [activeDestination, setActiveDestination] = useState<FieldKitDestination>('home');
  const [isInvestigationDrawerOpen, setIsInvestigationDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<DossierType | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [boardDossier, setBoardDossier] = useState<Dossier | null>(null);

  async function handleQuickAddSubmit(values: DossierFormValues) {
    await createNewDossier(values);
    setQuickAddType(null);
    setIsQuickAddOpen(false);
    setActiveDestination('dossiers');
  }

  return (
    <main className="field-kit" aria-label="LoreBound Field Kit">
      <FieldKitHeader
        activeCase={activeCase}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickAdd={() => setIsQuickAddOpen(true)}
      />

      <div className="field-kit-main">
        {activeDestination === 'home' ? (
          <FieldKitHome
            onNavigate={setActiveDestination}
            onOpenInvestigations={() => setIsInvestigationDrawerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : null}
        {activeDestination === 'dossiers' ? <FieldKitDossiers /> : null}
        {activeDestination === 'board' ? (
          boardDossier ? (
            <FieldKitDossiers
              initialType={boardDossier.dossierType}
              initialDossierId={boardDossier.id}
            />
          ) : (
            <FieldKitBoard
              onBrowseDossiers={() => setActiveDestination('dossiers')}
              onOpenDossier={(dossier) => {
                setBoardDossier(dossier);
                setActiveDestination('dossiers');
              }}
            />
          )
        ) : null}
        {activeDestination === 'more' ? (
          <FieldKitMore onOpenSettings={() => setIsSettingsOpen(true)} />
        ) : null}
      </div>

      <FieldKitNavigation
        activeDestination={activeDestination}
        onNavigate={(destination) => {
          setBoardDossier(null);
          setActiveDestination(destination);
        }}
      />

      {isInvestigationDrawerOpen ? (
        <FieldKitInvestigations
          onClose={() => setIsInvestigationDrawerOpen(false)}
          onOpened={() => {
            setIsInvestigationDrawerOpen(false);
            setActiveDestination('home');
          }}
        />
      ) : null}

      {isQuickAddOpen ? (
        <FieldKitQuickAdd
          onClose={() => setIsQuickAddOpen(false)}
          onChoose={(type) => {
            setQuickAddType(type);
            setIsQuickAddOpen(false);
          }}
        />
      ) : null}

      {quickAddType ? (
        <DossierFormDialog
          dossierType={quickAddType}
          onCancel={() => setQuickAddType(null)}
          onSubmit={handleQuickAddSubmit}
        />
      ) : null}

      {isSettingsOpen ? <LoreBoundSettings onClose={() => setIsSettingsOpen(false)} /> : null}
    </main>
  );
}
