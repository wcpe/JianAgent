export const DEFAULT_SERVER_HOST = 'localhost';
export const DEFAULT_SERVER_PORT = 25565;

export function formatServerAddress(host?: string, port?: number): string {
  return `${host ?? DEFAULT_SERVER_HOST}:${port ?? DEFAULT_SERVER_PORT}`;
}
