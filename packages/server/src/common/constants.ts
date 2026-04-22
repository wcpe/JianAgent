import { readPluginBridgeConfig, readServerConfig } from './network-config.js';

export const SERVER_PORT = readServerConfig().port;
export const PLUGIN_BRIDGE_PORT = readPluginBridgeConfig().port;
export const DB_PATH = process.env['DB_PATH'] ?? './data/jian-agent.db';
