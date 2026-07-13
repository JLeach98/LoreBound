import { environmentManager } from '../environment/EnvironmentManager';
import { cloudStorageProvider } from './CloudStorageProvider';
import { indexedDbStorageProvider } from './IndexedDbStorageProvider';
import type { StorageProvider } from './StorageProvider';

export function getActiveStorageProvider(): StorageProvider {
  const environment = environmentManager.getEnvironment();

  if (environment.isCloudConfigured && cloudStorageProvider.getStatus().isAvailable) {
    return cloudStorageProvider;
  }

  return indexedDbStorageProvider;
}
