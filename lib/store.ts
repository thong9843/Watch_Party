import { create } from 'zustand';

interface CinemaStore {
  // Discrete state only - NO per-frame position in React state
  isMoving: boolean;
  isSeated: boolean;
  activeNearbySeat: string | null;

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

  // Setters for discrete states
  setIsMoving: (isMoving: boolean) => void;
  setIsSeated: (isSeated: boolean) => void;
  setActiveNearbySeat: (seat: string | null) => void;

  // Queue info (when room reaches 60 capacity)
  queuePosition: number | null;
  setQueuePosition: (pos: number | null) => void;
}

export const useCinemaStore = create<CinemaStore>((set) => ({
  isMoving: false,
  isSeated: false,
  activeNearbySeat: null,

  cameraMode: 'follow',
  setCameraMode: (cameraMode) => set({ cameraMode }),
  actionFocusTarget: null,
  setActionFocusTarget: (actionFocusTarget) => set({ actionFocusTarget }),
  followOtherActions: false,
  setFollowOtherActions: (followOtherActions) => set({ followOtherActions }),

  joystickVector: { x: 0, y: 0 },
  setJoystickVector: (joystickVector) => set({ joystickVector }),

  setIsMoving: (isMoving) => set({ isMoving }),
  setIsSeated: (isSeated) => set({ isSeated }),
  setActiveNearbySeat: (activeNearbySeat) => set({ activeNearbySeat }),

  queuePosition: null,
  setQueuePosition: (queuePosition) => set({ queuePosition }),
}));
