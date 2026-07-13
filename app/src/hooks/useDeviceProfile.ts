import { useEffect, useState } from 'react';

export type DeviceProfile = {
  viewport: 'desktop' | 'tablet' | 'phone';
  pointer: 'fine' | 'coarse';
  orientation: 'landscape' | 'portrait';
  isTouch: boolean;
  prefersReducedMotion: boolean;
};

function readDeviceProfile(): DeviceProfile {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  return {
    viewport: width < 760 ? 'phone' : width < 1100 ? 'tablet' : 'desktop',
    pointer: hasCoarsePointer ? 'coarse' : 'fine',
    orientation: width >= height ? 'landscape' : 'portrait',
    isTouch: navigator.maxTouchPoints > 0 || hasCoarsePointer,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

export function useDeviceProfile() {
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile>(() => {
    if (typeof window === 'undefined') {
      return {
        viewport: 'desktop',
        pointer: 'fine',
        orientation: 'landscape',
        isTouch: false,
        prefersReducedMotion: false,
      };
    }

    return readDeviceProfile();
  });

  useEffect(() => {
    const updateDeviceProfile = () => setDeviceProfile(readDeviceProfile());
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: coarse)');

    window.addEventListener('resize', updateDeviceProfile);
    window.addEventListener('orientationchange', updateDeviceProfile);
    reducedMotionQuery.addEventListener('change', updateDeviceProfile);
    pointerQuery.addEventListener('change', updateDeviceProfile);

    return () => {
      window.removeEventListener('resize', updateDeviceProfile);
      window.removeEventListener('orientationchange', updateDeviceProfile);
      reducedMotionQuery.removeEventListener('change', updateDeviceProfile);
      pointerQuery.removeEventListener('change', updateDeviceProfile);
    };
  }, []);

  return deviceProfile;
}
