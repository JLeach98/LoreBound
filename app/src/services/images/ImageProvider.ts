export type StoredImage = {
  value: string;
  storageMode: 'local' | 'cloud';
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
      label: 'Cloud Image Storage Unconfigured',
      isAvailable: false,
    };
  }

  async storeImage(): Promise<StoredImage> {
    throw new Error('Cloud image storage is not configured.');
  }

  async resolveImage(): Promise<string> {
    throw new Error('Cloud image storage is not configured.');
  }
}

export const localImageProvider = new LocalImageProvider();
export const cloudImageProvider = new CloudImageProvider();
export const activeImageProvider: ImageProvider = localImageProvider;
