export type ActionType = 'crow' | 'shout' | 'siuu';

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
}

export type RoomEvent =
  | { type: 'chat'; id: string; text: string }
  | { type: 'action'; id: string; action: ActionType };

export interface RoomConn {
  mode: 'supabase' | 'local';
  track(m: Member): void;
  send(e: RoomEvent): void;
  onMembers(cb: (members: Member[]) => void): void;
  onEvent(cb: (event: RoomEvent) => void): void;
  close(): void;
}

