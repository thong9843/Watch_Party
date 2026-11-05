import * as THREE from 'three';

export interface RemotePlayerData {
  x: number;
  y: number;
  z: number;
  rotY: number;
  isMoving: boolean;
  pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe';
}

// Global shared refs to eliminate React re-renders every frame
// Flat floor y = 0. Spawn at top of center aisle behind Row F, facing forward towards screen
export const localPosRef = new THREE.Vector3(0, 0, 11.5);
export const localRotRef = { y: Math.PI };
export const cameraYawRef = { value: 0 };

// Map of remote player positions (updated via socket, read inside useFrame)
export const remotePlayersMap = new Map<string, RemotePlayerData>();

export function setRemotePlayerData(id: string, data: RemotePlayerData): void {
  remotePlayersMap.set(id, data);
}

export function removeRemotePlayerData(id: string): void {
  remotePlayersMap.delete(id);
}
