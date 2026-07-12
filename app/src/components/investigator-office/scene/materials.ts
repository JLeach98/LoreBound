import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

export type Materials = ReturnType<typeof useOfficeMaterials>;

export function useOfficeMaterials() {
  return useMemo(
    () => ({
      wall: new MeshStandardMaterial({ color: '#d2c1aa', roughness: 0.9 }),
      sideWall: new MeshStandardMaterial({ color: '#c4b198', roughness: 0.92 }),
      floor: new MeshStandardMaterial({ color: '#51321f', roughness: 0.78 }),
      walnut: new MeshStandardMaterial({ color: '#53331f', roughness: 0.64 }),
      darkWood: new MeshStandardMaterial({ color: '#2a1a12', roughness: 0.7 }),
      cork: new MeshStandardMaterial({ color: '#b87f4d', roughness: 0.94 }),
      brass: new MeshStandardMaterial({
        color: '#b8893f',
        metalness: 0.32,
        roughness: 0.42,
      }),
      brassDark: new MeshStandardMaterial({
        color: '#7f5a25',
        metalness: 0.24,
        roughness: 0.5,
      }),
      leather: new MeshStandardMaterial({ color: '#392319', roughness: 0.74 }),
      paper: new MeshStandardMaterial({ color: '#d6c39f', roughness: 0.9 }),
      paperEdge: new MeshStandardMaterial({ color: '#efdfbf', roughness: 0.92 }),
      folder: new MeshStandardMaterial({ color: '#c09a61', roughness: 0.88 }),
      folderLight: new MeshStandardMaterial({ color: '#d0b177', roughness: 0.88 }),
      book: new MeshStandardMaterial({ color: '#7d1c29', roughness: 0.78 }),
      deepGraphite: new MeshStandardMaterial({ color: '#171514', roughness: 0.68 }),
    }),
    [],
  );
}
