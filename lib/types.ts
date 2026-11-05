export type ActionType = 'crow' | 'shout' | 'siuu';
export type ControlMode = 'keyboard' | 'mouse';

export interface OxygenSession {
  tank: number;
  start: number;
}

export interface Member {
  id: string;
  name: string;
  color: string;
  seat: string | null;
  seatAt: number;
  oxygen: OxygenSession | null;
  joinedAt?: number;
  videoVersion?: number;
}

// Compact Position Tuple: [id, x, z, rotY, pose]
// pose: 0=idle, 1=walk, 2=sit, 3=crawl, 4=breathe
export type CompactPosTuple = [string, number, number, number, number];

export interface PlayerPosUpdate {
  type: 'pos';
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  isMoving: boolean;
  pose?: 'walk' | 'sit' | 'crawl' | 'idle' | 'breathe';
}

export type RoomEvent =
  | { type: 'chat'; id: string; text: string }
  | { type: 'action'; id: string; action: ActionType }
  | PlayerPosUpdate
  | CompactPosTuple;

export interface RoomConfigData {
  room_id: string;
  video_url: string;
  top_banner: string;
  bottom_banner: string;
  cinema_lights: 'on' | 'off';
  updated_at?: string;
}

export interface RoomConn {
  mode: 'supabase' | 'local';
  track(m: Member): void;
  send(e: RoomEvent): void;
  onMembers(cb: (members: Member[]) => void): void;
  onEvent(cb: (event: RoomEvent) => void): void;
  onConfig?: (cb: (config: RoomConfigData) => void) => void;
  close(): void;
}
