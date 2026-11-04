import { create } from 'zustand';
import { ControlMode } from './types';

export function getStoredControlMode(): ControlMode {
  if (typeof window === 'undefined') return 'keyboard';
  try {
    const val = localStorage.getItem('esports_control_mode');
    if (val === 'mouse' || val === 'keyboard') return val;
  } catch {
    // ignore
  }
  return 'keyboard';
}

export function setStoredControlMode(mode: ControlMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('esports_control_mode', mode);
  } catch {
    // ignore
  }
}

interface CinemaStore {
  // Discrete state only
  isMoving: boolean;
  isSeated: boolean;
  activeNearbySeat: string | null;

  // Control Mode ('keyboard' | 'mouse')
  controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void;
  showControlModal: boolean;
  setShowControlModal: (show: boolean) => void;

  // Camera Control State
  cameraMode: 'follow' | 'cinema' | 'action_focus';
  setCameraMode: (mode: 'follow' | 'cinema' | 'action_focus') => void;
  cameraDistancePreset: 'near' | 'far';
  toggleCameraDistance: () => void;
  actionFocusTarget: { id: string; time: number } | null;
  setActionFocusTarget: (target: { id: string; time: number } | null) => void;
  followOtherActions: boolean;
  setFollowOtherActions: (val: boolean) => void;

  // Camera horizontal yaw (for camera-relative WASD movement)
  cameraYaw: number;
  setCameraYaw: (yaw: number) => void;

  // Mobile Joystick Vector
  joystickVector: { x: number; y: number };
  setJoystickVector: (vec: { x: number; y: number }) => void;

  // Setters for discrete states
  setIsMoving: (isMoving: boolean) => void;
  setIsSeated: (isSeated: boolean) => void;
  setActiveNearbySeat: (seat: string | null) => void;

  // Queue info
  queuePosition: number | null;
  setQueuePosition: (pos: number | null) => void;

  // Admin Broadcasted Video ID
  adminVideoId: string | null;
  setAdminVideoId: (id: string | null) => void;
}

export const useCinemaStore = create<CinemaStore>((set) => ({
  isMoving: false,
  isSeated: false,
  activeNearbySeat: null,

  controlMode: typeof window !== 'undefined' ? getStoredControlMode() : 'keyboard',
  setControlMode: (controlMode) => {
    setStoredControlMode(controlMode);
    set({ controlMode });
  },
  showControlModal: false,
  setShowControlModal: (showControlModal) => set({ showControlModal }),

  cameraMode: 'follow',
  setCameraMode: (cameraMode) => set({ cameraMode }),
  cameraDistancePreset: 'far', // Mặc định góc nhìn xa ~6.5
  toggleCameraDistance: () =>
    set((state) => ({
      cameraDistancePreset: state.cameraDistancePreset === 'far' ? 'near' : 'far',
    })),
  actionFocusTarget: null,
  setActionFocusTarget: (actionFocusTarget) => set({ actionFocusTarget }),
  followOtherActions: false,
  setFollowOtherActions: (followOtherActions) => set({ followOtherActions }),

  cameraYaw: 0,
  setCameraYaw: (cameraYaw) => set({ cameraYaw }),

  joystickVector: { x: 0, y: 0 },
  setJoystickVector: (joystickVector) => set({ joystickVector }),

  setIsMoving: (isMoving) => set({ isMoving }),
  setIsSeated: (isSeated) => set({ isSeated }),
  setActiveNearbySeat: (activeNearbySeat) => set({ activeNearbySeat }),

  queuePosition: null,
  setQueuePosition: (queuePosition) => set({ queuePosition }),

  adminVideoId: null,
  setAdminVideoId: (adminVideoId) => set({ adminVideoId }),
}));
