import { useState, type FormEvent } from 'react';
import { authService, type AuthFailure, type AuthStatus } from '../../services/auth/AuthService';

type AccessMode = 'sign-in' | 'sign-up';

type LoreBoundAccessScreenProps = {
  onAuthResolved: (status: AuthStatus) => void;
};

function getReadableAuthError(error: AuthFailure) {
  const message = error.message.toLocaleLowerCase();
  const code = error.code.toLocaleLowerCase();

  if (!navigator.onLine) {
    return 'LoreBound Online is unavailable while this browser is offline.';
  }

  if (message.includes('invalid email') || code.includes('email')) {
    return 'Enter a valid email address for your Investigator Profile.';
  }

  if (message.includes('weak') || message.includes('password')) {
    return 'Use a stronger password for your Investigator Profile.';
  }

  if (message.includes('already') || code.includes('already')) {
    return 'An Investigator Profile may already exist for that email. Try Investigator Connect.';
  }

  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'Unable to connect your Investigator Profile. Please verify your credentials and try again.';
  }

  if (message.includes('confirm') || message.includes('not confirmed')) {
    return 'Confirm your email before connecting your Investigator Profile.';
  }

  if (message.includes('rate') || message.includes('too many') || code.includes('rate')) {
    return 'Too many connection attempts. Wait a moment before trying again.';
  }

  return 'Unable to connect your Investigator Profile. Please verify your credentials and try again.';
}

export function LoreBoundAccessScreen({ onAuthResolved }: LoreBoundAccessScreenProps) {
  const [mode, setMode] = useState<AccessMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';
  const passwordMismatch = isSignUp && password !== confirmPassword;
  const formInvalid =
    email.trim().length === 0 ||
    password.length < 6 ||
    passwordMismatch ||
    isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (formInvalid) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const result = isSignUp
      ? await authService.signUp({ email: email.trim(), password })
      : await authService.signIn({ email: email.trim(), password });

    if (!result.ok) {
      setMessage(getReadableAuthError(result.error));
      setIsSubmitting(false);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    onAuthResolved(result.status);
    setIsSubmitting(false);

    if (result.status.state === 'confirmation-required') {
      setMessage('Investigator Profile created. Confirm your email before connecting.');
    }
  }

  return (
    <main className="entry-screen entry-screen--access">
      <section className="entry-panel" aria-labelledby="access-title">
        <p className="entry-panel__eyebrow">LoreBound</p>
        <h1 id="access-title">Welcome, Investigator</h1>
        <p>Access LoreBound with your credentials to begin.</p>

        <form className="entry-form" onSubmit={handleSubmit}>
          <label htmlFor="entry-email">Email</label>
          <input
            id="entry-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            required
          />

          <label htmlFor="entry-password">Password</label>
          <input
            id="entry-password"
            type="password"
            value={password}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
            required
          />

          {isSignUp ? (
            <>
              <label htmlFor="entry-confirm-password">Confirm Password</label>
              <input
                id="entry-confirm-password"
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </>
          ) : null}

          {passwordMismatch ? (
            <p className="entry-form__error">Passwords must match.</p>
          ) : null}
          {message ? <p className="entry-form__error" role="status">{message}</p> : null}

          <button type="submit" className="auth-button auth-button--primary" disabled={formInvalid}>
            {isSubmitting ? 'Opening Archive...' : 'Access LoreBound'}
          </button>
        </form>

        <div className="entry-panel__secondary-actions">
          <button
            type="button"
            className="auth-button auth-button--quiet"
            onClick={() => {
              setMode(isSignUp ? 'sign-in' : 'sign-up');
              setMessage(null);
              setConfirmPassword('');
            }}
            disabled={isSubmitting}
          >
            {isSignUp ? 'Investigator Connect' : 'Create Investigator Profile'}
          </button>
        </div>
      </section>
    </main>
  );
}
