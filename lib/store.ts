import { create } from 'zustand';
import { ActionType } from './types';

export interface RemotePlayerState {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  isMoving: boolean;
  pose: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe';
  lastUpdate: number;
}

interface CinemaStore {
  // Local Player Input & State
  localPos: [number, number, number];
  localRotY: number;
  isMoving: boolean;
  isSeated: boolean;
  targetMovePos: [number, number, number] | null;
  targetSeatCode: string | null;
  activeNearbySeat: string | null;

  // Remote Players State
  remotePlayers: Record<string, RemotePlayerState>;
  setRemotePlayer: (id: string, state: Partial<RemotePlayerState>) => void;
  removeRemotePlayer: (id: string) => void;

  // Camera Control State
  cameraMode: 'follow' | 'cinema' | 'action_focus';
  setCameraMode: (mode: 'follow' | 'cinema' | 'action_focus') => void;
  actionFocusTarget: { id: string; time: number } | null;
  setActionFocusTarget: (target: { id: string; time: number } | null) => void;
  followOtherActions: boolean;
  setFollowOtherActions: (val: boolean) => void;

  // Mobile Joystick Vector
  joystickVector: { x: number; y: number };
  setJoystickVector: (vec: { x: number; y: number }) => void;

  // Local Actions
  setLocalPos: (pos: [number, number, number]) => void;
  setLocalRotY: (rotY: number) => void;
  setIsMoving: (isMoving: boolean) => void;
  setIsSeated: (isSeated: boolean) => void;
  setTargetMovePos: (pos: [number, number, number] | null) => void;
  setTargetSeatCode: (seat: string | null) => void;
  setActiveNearbySeat: (seat: string | null) => void;

  // Queue info (when room reaches 60 capacity)
  queuePosition: number | null;
  setQueuePosition: (pos: number | null) => void;
}

export const useCinemaStore = create<CinemaStore>((set) => ({
  localPos: [0, 2.8, 13.5], // Back entrance door
  localRotY: Math.PI,
  isMoving: false,
  isSeated: false,
  targetMovePos: null,
  targetSeatCode: null,
  activeNearbySeat: null,

  remotePlayers: {},
  setRemotePlayer: (id, partial) =>
    set((state) => {
      const existing = state.remotePlayers[id] || {
        id,
        x: 0,
        y: 2.8,
        z: 13.5,
        rotY: Math.PI,
        isMoving: false,
        pose: 'idle',
        lastUpdate: Date.now(),
      };
      return {
        remotePlayers: {
          ...state.remotePlayers,
          [id]: {
            ...existing,
            ...partial,
            lastUpdate: Date.now(),
          },
        },
      };
    }),
  removeRemotePlayer: (id) =>
    set((state) => {
      const next = { ...state.remotePlayers };
      delete next[id];
      return { remotePlayers: next };
    }),

  cameraMode: 'follow',
  setCameraMode: (cameraMode) => set({ cameraMode }),
  actionFocusTarget: null,
  setActionFocusTarget: (actionFocusTarget) => set({ actionFocusTarget }),
  followOtherActions: false,
  setFollowOtherActions: (followOtherActions) => set({ followOtherActions }),

  joystickVector: { x: 0, y: 0 },
  setJoystickVector: (joystickVector) => set({ joystickVector }),

  setLocalPos: (localPos) => set({ localPos }),
  setLocalRotY: (localRotY) => set({ localRotY }),
  setIsMoving: (isMoving) => set({ isMoving }),
  setIsSeated: (isSeated) => set({ isSeated }),
  setTargetMovePos: (targetMovePos) => set({ targetMovePos }),
  setTargetSeatCode: (targetSeatCode) => set({ targetSeatCode }),
  setActiveNearbySeat: (activeNearbySeat) => set({ activeNearbySeat }),

  queuePosition: null,
  setQueuePosition: (queuePosition) => set({ queuePosition }),
}));
