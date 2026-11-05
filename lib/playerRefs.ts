import * as THREE from 'three';
import { SPAWN_POS } from './layout';

export interface RemotePlayerData {
  x: number;
  y: number;
  z: number;
  rotY: number;
  isMoving: boolean;
  pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe';
}

// Global shared refs to eliminate React re-renders every frame
// Flat floor y = 0. Spawn at back lounge behind Row F (z = 22.0), facing forward towards screen (-Z)
export const localPosRef = new THREE.Vector3(SPAWN_POS.x, SPAWN_POS.y, SPAWN_POS.z);
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
