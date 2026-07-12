import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

export type Materials = ReturnType<typeof useOfficeMaterials>;

export function useOfficeMaterials() {
  return useMemo(
    () => ({
      wall: new MeshStandardMaterial({ color: '#d8cab6', roughness: 0.86 }),
      sideWall: new MeshStandardMaterial({ color: '#cdbcaa', roughness: 0.9 }),
      floor: new MeshStandardMaterial({ color: '#5c3a26', roughness: 0.72 }),
      walnut: new MeshStandardMaterial({ color: '#5c3a26', roughness: 0.58 }),
      darkWood: new MeshStandardMaterial({ color: '#2f1d14', roughness: 0.64 }),
      cork: new MeshStandardMaterial({ color: '#bd8753', roughness: 0.92 }),
      brass: new MeshStandardMaterial({
        color: '#b88a3d',
        metalness: 0.38,
        roughness: 0.36,
      }),
      brassDark: new MeshStandardMaterial({
        color: '#7f5a25',
        metalness: 0.28,
        roughness: 0.44,
      }),
      leather: new MeshStandardMaterial({ color: '#3f271d', roughness: 0.68 }),
      paper: new MeshStandardMaterial({ color: '#d9c7a8', roughness: 0.88 }),
      paperEdge: new MeshStandardMaterial({ color: '#f1e3c8', roughness: 0.9 }),
      folder: new MeshStandardMaterial({ color: '#c5a36e', roughness: 0.86 }),
      folderLight: new MeshStandardMaterial({ color: '#d4ba83', roughness: 0.86 }),
      book: new MeshStandardMaterial({ color: '#8f1d2c', roughness: 0.74 }),
      deepGraphite: new MeshStandardMaterial({ color: '#171514', roughness: 0.62 }),
    }),
    [],
  );
}
