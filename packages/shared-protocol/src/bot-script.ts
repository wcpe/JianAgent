export interface BotScript {
  readonly id: string;
  readonly name: string;
  readonly loop: boolean;
  readonly loopCount?: number; // undefined = infinite
  readonly steps: readonly BotScriptStep[];
}

export interface BotScriptStep {
  readonly action: BotScriptAction;
  readonly params: Readonly<Record<string, unknown>>;
}

export type BotScriptAction =
  | 'walk' | 'chat' | 'wait' | 'turn' | 'jump'
  | 'attack' | 'use_item' | 'look' | 'move_to';

export const SCRIPT_PRESETS: readonly BotScript[] = [
  {
    id: 'preset-idle',
    name: '挂机',
    loop: true,
    steps: [{ action: 'wait', params: { seconds: '8~15' } }],
  },
  {
    id: 'preset-walk-random',
    name: '随机行走',
    loop: true,
    steps: [
      { action: 'walk', params: { direction: 'random', blocks: '3~8' } },
      { action: 'wait', params: { seconds: '1~4' } },
    ],
  },
  {
    id: 'preset-patrol',
    name: '巡逻',
    loop: true,
    steps: [
      { action: 'walk', params: { direction: 'forward', blocks: '8~15' } },
      { action: 'turn', params: { direction: 'right', degrees: '80~100' } },
      { action: 'walk', params: { direction: 'forward', blocks: '8~15' } },
      { action: 'turn', params: { direction: 'right', degrees: '80~100' } },
    ],
  },
  {
    id: 'preset-chat-spam',
    name: '聊天',
    loop: true,
    steps: [
      { action: 'chat', params: { message: '压测中...' } },
      { action: 'wait', params: { seconds: '3~8' } },
    ],
  },
  {
    id: 'preset-combat',
    name: '战斗',
    loop: true,
    steps: [
      { action: 'look', params: { target: 'nearest_entity' } },
      { action: 'attack', params: {} },
      { action: 'wait', params: { seconds: '0.5~2' } },
    ],
  },
  {
    id: 'preset-follow',
    name: '跟随',
    loop: true,
    steps: [
      { action: 'look', params: { target: 'nearest_player' } },
      { action: 'move_to', params: { target: 'nearest_player', distance: '2~5' } },
      { action: 'wait', params: { seconds: '0.5~2' } },
    ],
  },
];
