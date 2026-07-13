export type MigrationPlan = {
  id: string;
  title: string;
  source: 'indexeddb';
  target: 'cloud';
  status: 'planned' | 'blocked';
};

export type MigrationStatus = {
  isAvailable: boolean;
  plans: MigrationPlan[];
};

class MigrationManager {
  getStatus(): MigrationStatus {
    return {
      isAvailable: false,
      plans: [
        {
          id: 'indexeddb-to-cloud',
          title: 'IndexedDB to Cloud Library',
          source: 'indexeddb',
          target: 'cloud',
          status: 'planned',
        },
      ],
    };
  }
}

export const migrationManager = new MigrationManager();
