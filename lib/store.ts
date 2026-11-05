import { create } from 'zustand';
import { ControlMode } from './types';
import { DEFAULT_BOTTOM_BANNER, DEFAULT_TOP_BANNER } from './banners';

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

export function getStoredCinemaLights(): 'on' | 'off' {
  if (typeof window === 'undefined') return 'on';
  try {
    const val = localStorage.getItem('esports_cinema_lights');
    if (val === 'on' || val === 'off') return val;
  } catch {
    // ignore
  }
  return 'on';
}

export function setStoredCinemaLights(mode: 'on' | 'off'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('esports_cinema_lights', mode);
  } catch {
    // ignore
  }
}

export type GraphicsQuality = 'auto' | 'high' | 'med' | 'low';

export function getStoredGraphicsQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'auto';
  try {
    const val = localStorage.getItem('cinema_graphics_quality') as GraphicsQuality;
    if (val === 'auto' || val === 'high' || val === 'med' || val === 'low') return val;
  } catch {
    // ignore
  }
  return 'auto';
}

export function setStoredGraphicsQuality(quality: GraphicsQuality): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cinema_graphics_quality', quality);
  } catch {
    // ignore
  }
}

export function getStoredMutedUsers(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('muted_users');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function setStoredMutedUsers(users: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('muted_users', JSON.stringify(users));
  } catch {
    // ignore
  }
}

interface CinemaStore {
  // Discrete state only
  isMoving: boolean;
  isSeated: boolean;
  activeNearbySeat: string | null;

  // Lobby 3D mode
  isLobby: boolean;
  setIsLobby: (isLobby: boolean) => void;

  // Cinema Lights ('on' | 'off')
  cinemaLights: 'on' | 'off';
  setCinemaLights: (mode: 'on' | 'off') => void;
  toggleCinemaLights: () => void;

  // Control Mode ('keyboard' | 'mouse')
  controlMode: ControlMode;
  setControlMode: (mode: ControlMode) => void;
  showControlModal: boolean;
  setShowControlModal: (show: boolean) => void;

  // Camera Control State
  cameraMode: 'follow' | 'cinema' | 'action_focus' | 'lobby' | 'entering';
  setCameraMode: (mode: 'follow' | 'cinema' | 'action_focus' | 'lobby' | 'entering') => void;
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

  // Cheering Banners (v2.2)
  topBanner: string;
  bottomBanner: string;
  setBanners: (top: string, bottom: string) => void;

  // Graphics Quality (V3 O1)
  graphicsQuality: GraphicsQuality;
  setGraphicsQuality: (q: GraphicsQuality) => void;

  // Moderation: Muted Users (V3 O3)
  mutedUsers: string[];
  toggleMuteUser: (id: string) => void;
}

export const useCinemaStore = create<CinemaStore>((set) => ({
  isMoving: false,
  isSeated: false,
  activeNearbySeat: null,

  mutedUsers: typeof window !== 'undefined' ? getStoredMutedUsers() : [],
  toggleMuteUser: (userId: string) => {
    set((state) => {
      const isMuted = state.mutedUsers.includes(userId);
      const next = isMuted
        ? state.mutedUsers.filter((id) => id !== userId)
        : [...state.mutedUsers, userId];
      setStoredMutedUsers(next);
      return { mutedUsers: next };
    });
  },

  graphicsQuality: typeof window !== 'undefined' ? getStoredGraphicsQuality() : 'auto',
  setGraphicsQuality: (graphicsQuality) => {
    setStoredGraphicsQuality(graphicsQuality);
    set({ graphicsQuality });
  },

  isLobby: true,
  setIsLobby: (isLobby) => set({ isLobby }),

  cinemaLights: typeof window !== 'undefined' ? getStoredCinemaLights() : 'on',
  setCinemaLights: (cinemaLights) => {
    setStoredCinemaLights(cinemaLights);
    set({ cinemaLights });
  },
  toggleCinemaLights: () =>
    set((state) => {
      const next = state.cinemaLights === 'on' ? 'off' : 'on';
      setStoredCinemaLights(next);
      return { cinemaLights: next };
    }),

  controlMode: typeof window !== 'undefined' ? getStoredControlMode() : 'keyboard',
  setControlMode: (controlMode) => {
    setStoredControlMode(controlMode);
    set({ controlMode });
  },
  showControlModal: false,
  setShowControlModal: (showControlModal) => set({ showControlModal }),

  cameraMode: 'lobby', // Starts in lobby mode
  setCameraMode: (cameraMode) => set({ cameraMode }),
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

  topBanner: DEFAULT_TOP_BANNER,
  bottomBanner: DEFAULT_BOTTOM_BANNER,
  setBanners: (topBanner, bottomBanner) => set({ topBanner, bottomBanner }),
}));
