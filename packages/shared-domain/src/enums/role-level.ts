export const RoleLevel = {
  VIEWER: 0,
  OPERATOR: 1,
  TESTER: 2,
  TERMINAL: 3,
  DANGER: 4,
  ADMIN: 5,
} as const;

export type RoleLevel = (typeof RoleLevel)[keyof typeof RoleLevel];
