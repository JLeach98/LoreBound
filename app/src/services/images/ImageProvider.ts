import { supabase } from '../../lib/supabase';

export type StoredImage = {
  value: string;
  storageMode: 'local' | 'cloud';
};

export type CloudImageEntityType = 'investigations' | 'dossiers' | 'profiles';

export type LocalImageCandidate = {
  entityType: CloudImageEntityType;
  recordId: string;
  localValue: string;
};

export type PreparedCloudImage = {
  entityType: CloudImageEntityType;
  recordId: string;
  localValue: string;
  path: string;
  blob: Blob;
  contentType: string;
  size: number;
};

export type ImageStorageReadiness = {
  bucketReachable: boolean;
  canRead: boolean;
  message?: string;
};

export interface ImageProvider {
  getStatus: () => {
    mode: 'local' | 'cloud';
    label: string;
    isAvailable: boolean;
  };
  storeImage: (imageDataUrl: string) => Promise<StoredImage>;
  resolveImage: (storedImage: StoredImage | string) => Promise<string>;
}

export const imageBucketName = 'lorebound-images';
const maxCloudImageDimension = 1800;
const maxCloudImageBytes = 5_000_000;
const webpQuality = 0.86;

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 120);
}

function getImageFilename(entityType: CloudImageEntityType) {
  if (entityType === 'investigations') {
    return 'cover.webp';
  }

  if (entityType === 'profiles') {
    return 'profile-photo.webp';
  }

  return 'image.webp';
}

export function createCloudImagePath(
  userId: string,
  entityType: CloudImageEntityType,
  recordId: string,
) {
  const safeUserId = sanitizePathSegment(userId);
  const safeRecordId = sanitizePathSegment(recordId);

  return `${safeUserId}/${entityType}/${safeRecordId}/${getImageFilename(entityType)}`;
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);

  if (!match) {
    throw new Error('The stored image format is not supported.');
  }

  const [, mimeType, isBase64, data] = match;
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error('The image could not be restored.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('The image could not be restored.'));
    };
    reader.readAsDataURL(blob);
  });
}

function loadImageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The stored image could not be prepared.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function optimizeImageBlob(blob: Blob) {
  if (blob.size > maxCloudImageBytes) {
    throw new Error('A stored image exceeds LoreBound Online image limits.');
  }

  if (blob.type === 'image/gif' || blob.type === 'image/svg+xml') {
    return {
      blob,
      contentType: blob.type || 'application/octet-stream',
    };
  }

  const image = await loadImageFromBlob(blob);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);

  if (!largestSide) {
    throw new Error('The stored image dimensions could not be read.');
  }

  const scale = Math.min(1, maxCloudImageDimension / largestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return {
      blob,
      contentType: blob.type || 'application/octet-stream',
    };
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const webpBlob = await canvasToBlob(canvas, 'image/webp', webpQuality);
  const optimizedBlob = webpBlob && webpBlob.size <= blob.size ? webpBlob : blob;

  if (optimizedBlob.size > maxCloudImageBytes) {
    throw new Error('A stored image could not be prepared within LoreBound Online image limits.');
  }

  return {
    blob: optimizedBlob,
    contentType: optimizedBlob === webpBlob ? 'image/webp' : blob.type || 'application/octet-stream',
  };
}

class LocalImageProvider implements ImageProvider {
  getStatus() {
    return {
      mode: 'local' as const,
      label: 'Local Image Storage',
      isAvailable: true,
    };
  }

  async storeImage(imageDataUrl: string): Promise<StoredImage> {
    return {
      value: imageDataUrl,
      storageMode: 'local',
    };
  }

  async resolveImage(storedImage: StoredImage | string): Promise<string> {
    return typeof storedImage === 'string' ? storedImage : storedImage.value;
  }
}

class CloudImageProvider implements ImageProvider {
  getStatus() {
    return {
      mode: 'cloud' as const,
      label: supabase ? 'LoreBound Online Image Storage' : 'LoreBound Online Image Storage Unavailable',
      isAvailable: Boolean(supabase),
    };
  }

  async storeImage(imageDataUrl: string): Promise<StoredImage> {
    return {
      value: imageDataUrl,
      storageMode: 'local',
    };
  }

  async resolveImage(storedImage: StoredImage | string): Promise<string> {
    return typeof storedImage === 'string' ? storedImage : storedImage.value;
  }

  async checkReadiness(userId: string): Promise<ImageStorageReadiness> {
    if (!supabase) {
      return {
        bucketReachable: false,
        canRead: false,
        message: 'LoreBound Online image storage is not available for this Investigator Profile.',
      };
    }

    const { error } = await supabase.storage
      .from(imageBucketName)
      .list(sanitizePathSegment(userId), { limit: 1 });

    if (error) {
      return {
        bucketReachable: false,
        canRead: false,
        message: 'LoreBound Online image storage is not available for this Investigator Profile.',
      };
    }

    return {
      bucketReachable: true,
      canRead: true,
    };
  }

  async prepareImage(candidate: LocalImageCandidate, userId: string): Promise<PreparedCloudImage> {
    const originalBlob = dataUrlToBlob(candidate.localValue);
    const optimized = await optimizeImageBlob(originalBlob);

    return {
      entityType: candidate.entityType,
      recordId: candidate.recordId,
      localValue: candidate.localValue,
      path: createCloudImagePath(userId, candidate.entityType, candidate.recordId),
      blob: optimized.blob,
      contentType: optimized.contentType,
      size: optimized.blob.size,
    };
  }

  async uploadImage(image: PreparedCloudImage) {
    if (!supabase) {
      throw new Error('LoreBound Online image storage is not available.');
    }

    const { error } = await supabase.storage.from(imageBucketName).upload(image.path, image.blob, {
      contentType: image.contentType,
      upsert: true,
    });

    if (error) {
      throw new Error('A stored image could not be secured through LoreBound Online.');
    }

    return image.path;
  }

  async replaceImage(image: PreparedCloudImage) {
    return this.uploadImage(image);
  }

  async imageExists(path: string) {
    if (!supabase) {
      return false;
    }

    const pathParts = path.split('/');
    const fileName = pathParts.pop();
    const folder = pathParts.join('/');

    if (!fileName || !folder) {
      return false;
    }

    const { data, error } = await supabase.storage.from(imageBucketName).list(folder, {
      limit: 100,
    });

    if (error) {
      return false;
    }

    return (data ?? []).some((item) => item.name === fileName);
  }

  async downloadImage(path: string) {
    if (!supabase) {
      throw new Error('LoreBound Online image storage is not available.');
    }

    const { data, error } = await supabase.storage.from(imageBucketName).download(path);

    if (error || !data) {
      throw new Error('A stored image could not be retrieved from LoreBound Online.');
    }

    return blobToDataUrl(data);
  }

  async createSignedUrl(path: string, expiresInSeconds = 300) {
    if (!supabase) {
      throw new Error('LoreBound Online image storage is not available.');
    }

    const { data, error } = await supabase.storage
      .from(imageBucketName)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error('A temporary image reference could not be created.');
    }

    return data.signedUrl;
  }

  async deleteImage(path: string) {
    if (!supabase) {
      throw new Error('LoreBound Online image storage is not available.');
    }

    const { error } = await supabase.storage.from(imageBucketName).remove([path]);

    if (error) {
      throw new Error('A stored image could not be removed from LoreBound Online.');
    }
  }
}

export const localImageProvider = new LocalImageProvider();
export const cloudImageProvider = new CloudImageProvider();
export const activeImageProvider: ImageProvider = localImageProvider;
