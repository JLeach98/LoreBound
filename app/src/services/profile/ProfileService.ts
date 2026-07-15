import { supabase } from '../../lib/supabase';
import { authService, type AuthUser } from '../auth/AuthService';
import { cloudImageProvider, createCloudImagePath, type PreparedCloudImage } from '../images/ImageProvider';

export type ProfileErrorKind =
  | 'migration-unavailable'
  | 'permission-denied'
  | 'offline'
  | 'duplicate'
  | 'unexpected';

export class ProfileServiceError extends Error {
  kind: ProfileErrorKind;
  code: string | null;
  status: number | null;

  constructor(kind: ProfileErrorKind, message: string, code: string | null, status: number | null) {
    super(message);
    this.name = 'ProfileServiceError';
    this.kind = kind;
    this.code = code;
    this.status = status;
  }
}

export type InvestigatorProfile = {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  badgeNumber: string;
  title: string;
  profilePhotoUrl: string | null;
  bio: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InvestigatorProfileUpdate = {
  username: string;
  displayName?: string;
  title: string;
  bio?: string;
  profilePhotoDataUrl?: string | null;
  removeProfilePhoto?: boolean;
  onboardingCompleted?: boolean;
};

type ProfileRow = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  badge_number: string;
  title: string;
  profile_photo_url: string | null;
  bio: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

function mapProfile(row: ProfileRow): InvestigatorProfile {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    badgeNumber: row.badge_number,
    title: row.title,
    profilePhotoUrl: row.profile_photo_url,
    bio: row.bio,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createFallbackUsername(user: AuthUser) {
  return `investigator-${user.id.replace(/-/g, '').slice(0, 12).toLowerCase()}`;
}

function cleanOptional(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function getErrorField(error: unknown, field: 'code' | 'message' | 'status') {
  if (error && typeof error === 'object' && field in error) {
    const value = (error as Record<string, unknown>)[field];

    if (field === 'status') {
      return typeof value === 'number' ? value : null;
    }

    return typeof value === 'string' ? value : null;
  }

  return null;
}

function sanitizeProfileErrorMessage(message: string | null) {
  return (message ?? 'Unable to open Investigator Profile.')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-token]')
    .trim();
}

function classifyProfileError(error: unknown) {
  const code = getErrorField(error, 'code') as string | null;
  const status = getErrorField(error, 'status') as number | null;
  const message = sanitizeProfileErrorMessage(getErrorField(error, 'message') as string | null);
  const normalized = `${code ?? ''} ${message}`.toLocaleLowerCase();

  if (!navigator.onLine) {
    return new ProfileServiceError('offline', 'LoreBound Online is unavailable while you are offline.', code, status);
  }

  if (
    normalized.includes('42p01') ||
    normalized.includes('pgrst205') ||
    normalized.includes('relation') ||
    normalized.includes('schema cache') ||
    normalized.includes('missing column') ||
    normalized.includes('42703')
  ) {
    return new ProfileServiceError(
      'migration-unavailable',
      'Investigator Profile setup is not yet available because LoreBound Online requires a database update.',
      code,
      status,
    );
  }

  if (normalized.includes('permission denied') || normalized.includes('42501')) {
    return new ProfileServiceError(
      'permission-denied',
      'Unable to open Investigator Profile. Your Local Archive remains available.',
      code,
      status,
    );
  }

  if (normalized.includes('23505') || normalized.includes('duplicate')) {
    return new ProfileServiceError(
      'duplicate',
      'That username is already assigned to another Investigator Profile.',
      code,
      status,
    );
  }

  return new ProfileServiceError(
    'unexpected',
    'Unable to open Investigator Profile. Your Local Archive remains available.',
    code,
    status,
  );
}

function createProfilePhotoImage(userId: string, imageDataUrl: string): PreparedCloudImage {
  const match = imageDataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);

  if (!match) {
    throw new Error('The profile photo format is not supported.');
  }

  const [, contentType, isBase64, data] = match;
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const path = createCloudImagePath(userId, 'profiles', userId);

  return {
    entityType: 'profiles',
    recordId: userId,
    localValue: imageDataUrl,
    path,
    blob: new Blob([bytes], { type: contentType }),
    contentType,
    size: bytes.length,
  };
}

class LoreBoundProfileService {
  async getProfile(userId: string) {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle<ProfileRow>();

    if (error) {
      throw classifyProfileError(error);
    }

    return data ? mapProfile(data) : null;
  }

  async ensureProfile(user: AuthUser) {
    if (!supabase) {
      return null;
    }

    const existingProfile = await this.getProfile(user.id);

    if (existingProfile) {
      return existingProfile;
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        username: createFallbackUsername(user),
        title: 'Investigator',
      })
      .select('*')
      .single<ProfileRow>();

    if (error) {
      throw classifyProfileError(error);
    }

    return mapProfile(data);
  }

  async updateProfile(profile: InvestigatorProfile, values: InvestigatorProfileUpdate) {
    if (!supabase) {
      throw new Error('LoreBound Online is not available.');
    }

    let nextPhotoPath = profile.profilePhotoUrl;

    if (values.removeProfilePhoto && profile.profilePhotoUrl) {
      await cloudImageProvider.deleteImage(profile.profilePhotoUrl);
      nextPhotoPath = null;
    }

    if (values.profilePhotoDataUrl) {
      const photo = createProfilePhotoImage(profile.userId, values.profilePhotoDataUrl);
      nextPhotoPath = await cloudImageProvider.uploadImage(photo);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: values.username.trim(),
        display_name: cleanOptional(values.displayName),
        title: values.title.trim(),
        bio: cleanOptional(values.bio),
        profile_photo_url: nextPhotoPath,
        onboarding_completed: values.onboardingCompleted ?? profile.onboardingCompleted,
      })
      .eq('id', profile.id)
      .select('*')
      .single<ProfileRow>();

    if (error) {
      throw classifyProfileError(error);
    }

    return mapProfile(data);
  }

  async resolveProfilePhoto(profile: InvestigatorProfile | null) {
    if (!profile?.profilePhotoUrl) {
      return null;
    }

    return cloudImageProvider.createSignedUrl(profile.profilePhotoUrl);
  }

  async getCurrentProfile() {
    const user = await authService.getCurrentUser();

    return user ? this.ensureProfile(user) : null;
  }
}

export const profileService = new LoreBoundProfileService();
