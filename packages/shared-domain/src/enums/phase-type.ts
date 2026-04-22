export const PhaseType = {
  WAITING: 'WAITING',
  LOGIN_IDLE: 'LOGIN_IDLE',
  LOBBY_GATHER: 'LOBBY_GATHER',
  GAME_PREPARE: 'GAME_PREPARE',
  GAME_PLAY: 'GAME_PLAY',
  GAME_END: 'GAME_END',
  RANDOM_WALK: 'RANDOM_WALK',
  STRESS_MOVE: 'STRESS_MOVE',
  CHAT_SPAM: 'CHAT_SPAM',
} as const;

export type PhaseType = (typeof PhaseType)[keyof typeof PhaseType];
