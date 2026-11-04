import * as THREE from 'three';

export interface RemotePlayerData {
  x: number;
  y: number;
  z: number;
  rotY: number;
  isMoving: boolean;
  pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe';
  lastUpdate: number;
}

// Global shared refs to eliminate React re-renders every frame
export const localPosRef = new THREE.Vector3(0, 2.8, 13.5);
export const localRotRef = { y: Math.PI };
export const cameraYawRef = { value: 0 };

// Map of remote player positions (updated via socket, read inside useFrame)
export const remotePlayersMap = new Map<string, RemotePlayerData>();

export function getRemotePlayerData(id: string): RemotePlayerData | undefined {
  return remotePlayersMap.get(id);
}

export function setRemotePlayerData(id: string, data: Partial<RemotePlayerData>): void {
  const existing = remotePlayersMap.get(id);
  if (existing) {
    if (data.x !== undefined) existing.x = data.x;
    if (data.y !== undefined) existing.y = data.y;
    if (data.z !== undefined) existing.z = data.z;
    if (data.rotY !== undefined) existing.rotY = data.rotY;
    if (data.isMoving !== undefined) existing.isMoving = data.isMoving;
    if (data.pose !== undefined) existing.pose = data.pose;
    existing.lastUpdate = Date.now();
  } else {
    remotePlayersMap.set(id, {
      x: data.x ?? 0,
      y: data.y ?? 2.8,
      z: data.z ?? 13.5,
      rotY: data.rotY ?? Math.PI,
      isMoving: data.isMoving ?? false,
      pose: data.pose ?? 'idle',
      lastUpdate: Date.now(),
    });
  }
}

export function removeRemotePlayerData(id: string): void {
  remotePlayersMap.delete(id);
}
