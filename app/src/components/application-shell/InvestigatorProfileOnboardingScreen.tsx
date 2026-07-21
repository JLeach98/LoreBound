import { useEffect, useState, type FormEvent } from 'react';
import { authService } from '../../services/auth/AuthService';
import { useInvestigatorProfile } from '../../services/profile/InvestigatorProfileContext';

type InvestigatorProfileOnboardingScreenProps = {
  onComplete: () => void;
};

export function InvestigatorProfileOnboardingScreen({ onComplete }: InvestigatorProfileOnboardingScreenProps) {
  const {
    profile,
    profilePhotoUrl,
    errorMessage,
    isLoading,
    saveProfile,
  } = useInvestigatorProfile();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [title, setTitle] = useState(profile?.title ?? 'Investigator');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(null);
  const [removeProfilePhoto, setRemoveProfilePhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setUsername(profile?.username ?? '');
    setDisplayName(profile?.displayName ?? '');
    setTitle(profile?.title ?? 'Investigator');
    setBio(profile?.bio ?? '');
  }, [profile]);

  const validation =
    username.trim().length < 3
      ? 'Choose a username with at least three characters.'
      : title.trim().length === 0
        ? 'Add an Investigator Title.'
        : null;

  function handlePhotoChange(file: File | null) {
    if (!file) {
      setProfilePhotoDataUrl(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfilePhotoDataUrl(reader.result);
        setRemoveProfilePhoto(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (validation) {
      setFormError(validation);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await saveProfile({
        username,
        displayName,
        title,
        bio,
        profilePhotoDataUrl,
        removeProfilePhoto,
        onboardingCompleted: true,
      });
      onComplete();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The Investigator Profile could not be prepared.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    await authService.signOut();
    setIsSubmitting(false);
  }

  return (
    <main className="entry-screen entry-screen--profile">
      <section className="entry-panel entry-panel--wide" aria-labelledby="profile-onboarding-title">
        <p className="entry-panel__eyebrow">Investigator Profile</p>
        <h1 id="profile-onboarding-title">Prepare Your Personnel File</h1>
        <p>Complete your Investigator Profile before entering the Archive.</p>

        {isLoading ? <p className="entry-form__status">Loading Investigator Profile...</p> : null}
        {errorMessage ? <p className="entry-form__error" role="alert">{errorMessage}</p> : null}

        <form className="entry-form entry-form--profile" onSubmit={handleSubmit}>
          <div className="profile-photo-editor">
            <div className="profile-credential__photo" aria-hidden="true">
              {profilePhotoDataUrl ? (
                <img src={profilePhotoDataUrl} alt="" />
              ) : profilePhotoUrl && !removeProfilePhoto ? (
                <img src={profilePhotoUrl} alt="" />
              ) : (
                <span>{username.slice(0, 2).toUpperCase() || 'LB'}</span>
              )}
            </div>
            <div>
              <label htmlFor="entry-profile-photo">Profile Photo</label>
              <input
                id="entry-profile-photo"
                type="file"
                accept="image/*"
                onChange={(event) => handlePhotoChange(event.currentTarget.files?.[0] ?? null)}
                disabled={isSubmitting}
              />
              {profile?.profilePhotoUrl ? (
                <button
                  type="button"
                  className="auth-button auth-button--quiet"
                  onClick={() => {
                    setRemoveProfilePhoto(true);
                    setProfilePhotoDataUrl(null);
                  }}
                  disabled={isSubmitting}
                >
                  Remove Photo
                </button>
              ) : null}
            </div>
          </div>

          <label htmlFor="entry-profile-username">Username</label>
          <input
            id="entry-profile-username"
            type="text"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
            disabled={isSubmitting}
            required
          />

          <label htmlFor="entry-profile-display-name">Display Name</label>
          <input
            id="entry-profile-display-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={isSubmitting}
          />

          <label htmlFor="entry-profile-title">Investigator Title</label>
          <input
            id="entry-profile-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            required
          />

          <label htmlFor="entry-profile-bio">Bio</label>
          <textarea
            id="entry-profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            disabled={isSubmitting}
            rows={4}
          />

          <small>Badge {profile?.badgeNumber ?? 'will be issued automatically'} cannot be changed.</small>
          {formError ?? validation ? (
            <p className="entry-form__error" role="alert">{formError ?? validation}</p>
          ) : null}

          <div className="entry-form__actions">
            <button
              type="submit"
              className="auth-button auth-button--primary"
              disabled={isSubmitting || Boolean(validation)}
            >
              {isSubmitting ? 'Preparing Profile...' : 'Enter LoreBound'}
            </button>
            <button
              type="button"
              className="auth-button auth-button--quiet"
              onClick={handleSignOut}
              disabled={isSubmitting}
            >
              Investigator Offline
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
