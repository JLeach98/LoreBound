import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authService, type AuthStatus } from '../auth/AuthService';
import {
  profileService,
  type InvestigatorProfile,
  type InvestigatorProfileUpdate,
  ProfileServiceError,
} from './ProfileService';

export type InvestigatorProfileState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'no-profile'
  | 'profile-creation-required'
  | 'migration-unavailable'
  | 'permission-denied'
  | 'offline'
  | 'unexpected-failure';

export type InvestigatorProfileDiagnostics = {
  authenticatedUserPresent: boolean;
  profileQueryStatus: 'not-run' | 'success' | 'failure';
  profileRecordFound: boolean;
  profileCreationAttempted: boolean;
  sanitizedErrorCode: string | null;
  sanitizedErrorMessage: string | null;
  httpStatus: number | null;
};

type ProfileContextValue = {
  profile: InvestigatorProfile | null;
  profilePhotoUrl: string | null;
  profileState: InvestigatorProfileState;
  diagnostics: InvestigatorProfileDiagnostics;
  isLoading: boolean;
  errorMessage: string | null;
  needsOnboarding: boolean;
  refreshProfile: () => Promise<void>;
  saveProfile: (values: InvestigatorProfileUpdate) => Promise<InvestigatorProfile>;
  clearProfileError: () => void;
};

const InvestigatorProfileContext = createContext<ProfileContextValue | null>(null);

const emptyDiagnostics: InvestigatorProfileDiagnostics = {
  authenticatedUserPresent: false,
  profileQueryStatus: 'not-run',
  profileRecordFound: false,
  profileCreationAttempted: false,
  sanitizedErrorCode: null,
  sanitizedErrorMessage: null,
  httpStatus: null,
};

export function InvestigatorProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<InvestigatorProfile | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<InvestigatorProfileState>('idle');
  const [diagnostics, setDiagnostics] = useState<InvestigatorProfileDiagnostics>(emptyDiagnostics);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfileForStatus = useCallback(async (status: AuthStatus) => {
    if (status.state !== 'signed-in' || !status.user) {
      setProfile(null);
      setProfilePhotoUrl(null);
      setProfileState('idle');
      setDiagnostics(emptyDiagnostics);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setProfileState('loading');
    setDiagnostics({
      ...emptyDiagnostics,
      authenticatedUserPresent: true,
      profileCreationAttempted: true,
    });

    try {
      const nextProfile = await profileService.ensureProfile(status.user);
      const nextPhotoUrl = await profileService.resolveProfilePhoto(nextProfile);
      setProfile(nextProfile);
      setProfilePhotoUrl(nextPhotoUrl);
      setProfileState(nextProfile ? 'loaded' : 'no-profile');
      setDiagnostics({
        ...emptyDiagnostics,
        authenticatedUserPresent: true,
        profileQueryStatus: 'success',
        profileRecordFound: Boolean(nextProfile),
        profileCreationAttempted: true,
      });
      setErrorMessage(null);
    } catch (error) {
      const profileError =
        error instanceof ProfileServiceError
          ? error
          : new ProfileServiceError(
              'unexpected',
              'The Investigator Profile could not be opened.',
              null,
              null,
            );
      const nextState =
        profileError.kind === 'migration-unavailable'
          ? 'migration-unavailable'
          : profileError.kind === 'permission-denied'
            ? 'permission-denied'
            : profileError.kind === 'offline'
              ? 'offline'
              : 'unexpected-failure';

      setProfile(null);
      setProfilePhotoUrl(null);
      setProfileState(nextState);
      setDiagnostics({
        ...emptyDiagnostics,
        authenticatedUserPresent: true,
        profileQueryStatus: 'failure',
        profileRecordFound: false,
        profileCreationAttempted: true,
        sanitizedErrorCode: profileError.code,
        sanitizedErrorMessage: profileError.message,
        httpStatus: profileError.status,
      });
      setErrorMessage(profileError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfileForStatus(await authService.getStatus());
  }, [loadProfileForStatus]);

  const saveProfile = useCallback(
    async (values: InvestigatorProfileUpdate) => {
      let editableProfile = profile;

      if (!editableProfile) {
        const status = await authService.getStatus();

        if (status.state !== 'signed-in' || !status.user) {
          throw new Error('Connect an Investigator Profile before editing personnel details.');
        }

        editableProfile = await profileService.ensureProfile(status.user);

        if (!editableProfile) {
          throw new Error('Investigator Profile setup is not available yet.');
        }
      }

      const updatedProfile = await profileService.updateProfile(editableProfile, values);
      const nextPhotoUrl = await profileService.resolveProfilePhoto(updatedProfile);
      setProfile(updatedProfile);
      setProfilePhotoUrl(nextPhotoUrl);
      setProfileState('loaded');
      setDiagnostics({
        ...diagnostics,
        profileQueryStatus: 'success',
        profileRecordFound: true,
        sanitizedErrorCode: null,
        sanitizedErrorMessage: null,
        httpStatus: null,
      });
      setErrorMessage(null);
      return updatedProfile;
    },
    [diagnostics, profile],
  );

  useEffect(() => {
    let isMounted = true;

    async function refreshInitialProfile() {
      setIsLoading(true);

      try {
        const status = await authService.getStatus();

        if (isMounted) {
          await loadProfileForStatus(status);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    const subscription = authService.onAuthStateChanged((status) => {
      void loadProfileForStatus(status);
    });

    void refreshInitialProfile();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfileForStatus]);

  const contextValue = useMemo(
    () => ({
      profile,
      profilePhotoUrl,
      profileState,
      diagnostics,
      isLoading,
      errorMessage,
      needsOnboarding: Boolean(profile && !profile.onboardingCompleted),
      refreshProfile,
      saveProfile,
      clearProfileError: () => setErrorMessage(null),
    }),
    [
      diagnostics,
      errorMessage,
      isLoading,
      profile,
      profileState,
      profilePhotoUrl,
      refreshProfile,
      saveProfile,
    ],
  );

  return (
    <InvestigatorProfileContext.Provider value={contextValue}>
      {children}
    </InvestigatorProfileContext.Provider>
  );
}

export function useInvestigatorProfile() {
  const context = useContext(InvestigatorProfileContext);

  if (!context) {
    throw new Error('useInvestigatorProfile must be used inside InvestigatorProfileProvider.');
  }

  return context;
}
