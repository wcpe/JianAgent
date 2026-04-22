export const CONTROL_PLANE_EVENTS = {
  agentRegistered: 'task:control-plane:agent:registered',
  agentHeartbeat: 'task:control-plane:agent:heartbeat',
  operationJobUpdated: 'task:control-plane:operation-job:updated',
} as const;

export type ControlPlaneEventName =
  (typeof CONTROL_PLANE_EVENTS)[keyof typeof CONTROL_PLANE_EVENTS];
