import { useEffect, useState } from 'react';

export type DeviceExperience = 'field-kit' | 'study';

function chooseDeviceExperience(): DeviceExperience {
  if (typeof window === 'undefined') {
    return 'study';
  }

  const width = window.innerWidth;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const hoverNone = window.matchMedia('(hover: none)').matches;
  const portrait = window.matchMedia('(orientation: portrait)').matches;

  if (width <= 820 && (coarsePointer || hoverNone)) {
    return 'field-kit';
  }

  if (width <= 1180 && coarsePointer && portrait) {
    return 'field-kit';
  }

  return 'study';
}

export function useDeviceExperience() {
  const [experience, setExperience] = useState<DeviceExperience>(chooseDeviceExperience);

  useEffect(() => {
    const updateExperience = () => setExperience(chooseDeviceExperience());
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: none)');
    const orientationQuery = window.matchMedia('(orientation: portrait)');

    updateExperience();
    window.addEventListener('resize', updateExperience);
    pointerQuery.addEventListener('change', updateExperience);
    hoverQuery.addEventListener('change', updateExperience);
    orientationQuery.addEventListener('change', updateExperience);

    return () => {
      window.removeEventListener('resize', updateExperience);
      pointerQuery.removeEventListener('change', updateExperience);
      hoverQuery.removeEventListener('change', updateExperience);
      orientationQuery.removeEventListener('change', updateExperience);
    };
  }, []);

  return experience;
}
