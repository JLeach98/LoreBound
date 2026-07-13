export type CloudServiceConfig = {
  enabled: boolean;
  provider: 'supabase' | 'custom' | 'none';
  supabaseUrl?: string;
  authEndpoint?: string;
  databaseEndpoint?: string;
  storageEndpoint?: string;
  deploymentTarget?: string;
};

export type RuntimeEnvironment = {
  appName: string;
  libraryMode: 'local' | 'cloud';
  isCloudConfigured: boolean;
  cloud: CloudServiceConfig;
};

function optionalEnv(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

class EnvironmentManager {
  getEnvironment(): RuntimeEnvironment {
    const supabaseUrl = optionalEnv(import.meta.env.VITE_SUPABASE_URL);
    const supabasePublishableKey = optionalEnv(
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
    const authEndpoint = optionalEnv(import.meta.env.VITE_LOREBOUND_AUTH_ENDPOINT);
    const databaseEndpoint = optionalEnv(import.meta.env.VITE_LOREBOUND_DATABASE_ENDPOINT);
    const storageEndpoint = optionalEnv(import.meta.env.VITE_LOREBOUND_STORAGE_ENDPOINT);
    const deploymentTarget = optionalEnv(import.meta.env.VITE_LOREBOUND_DEPLOYMENT_TARGET);
    const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
    const isCustomCloudConfigured = Boolean(authEndpoint && databaseEndpoint && storageEndpoint);
    const isCloudConfigured = isSupabaseConfigured || isCustomCloudConfigured;

    return {
      appName: 'LoreBound',
      libraryMode: isCloudConfigured ? 'cloud' : 'local',
      isCloudConfigured,
      cloud: {
        enabled: isCloudConfigured,
        provider: isSupabaseConfigured ? 'supabase' : isCustomCloudConfigured ? 'custom' : 'none',
        supabaseUrl,
        authEndpoint,
        databaseEndpoint,
        storageEndpoint,
        deploymentTarget,
      },
    };
  }
}

export const environmentManager = new EnvironmentManager();
