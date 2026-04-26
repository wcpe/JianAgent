import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Package,
  Users,
  ChevronDown,
  ChevronRight,
  Map,
  RefreshCw,
} from 'lucide-react';
import { botApi, type BotInventoryItem, type BotNearbyEntity, type BotTerrainBlock, type BotSnapshot } from '../../api/bot.api.js';

const BLOCK_COLORS: Record<string, string> = {
  grass_block: '#5d9b3a', short_grass: '#5d9b3a', tall_grass: '#4a8030',
  dirt: '#8b6914', coarse_dirt: '#7a5c10', rooted_dirt: '#6b4f0e',
  stone: '#888888', cobblestone: '#777777', deepslate: '#555555',
  granite: '#9a6b4a', diorite: '#c0b0a0', andesite: '#999999',
  sand: '#e8d68a', red_sand: '#c08040', gravel: '#8a7a6a',
  water: '#3366cc', oak_log: '#6b5030', spruce_log: '#3b2810',
  birch_log: '#c0b090', oak_leaves: '#3a7a20', spruce_leaves: '#2a5a10',
  birch_leaves: '#4a9a30', oak_planks: '#b08a50', snow: '#f0f0ff',
  snow_block: '#f0f0ff', ice: '#8ac8ff', packed_ice: '#7ab8ef',
  clay: '#a0a0b0', bedrock: '#333333', obsidian: '#1a0a2e',
  netherrack: '#6a2020', end_stone: '#d8d0a0', mycelium: '#7a6a8a',
  podzol: '#5a4a20', moss_block: '#4a7a30',
};

function getColor(name: string): string {
  if (BLOCK_COLORS[name]) return BLOCK_COLORS[name];
  if (name.includes('log') || name.includes('wood')) return '#6b5030';
  if (name.includes('leaves')) return '#3a7a20';
  if (name.includes('stone') || name.includes('ore')) return '#888888';
  if (name.includes('sand')) return '#e8d68a';
  if (name.includes('water')) return '#3366cc';
  if (name.includes('lava')) return '#cc4400';
  if (name.includes('snow') || name.includes('ice')) return '#d0e8ff';
  if (name.includes('plank') || name.includes('fence') || name.includes('door')) return '#b08a50';
  return '#666666';
}

interface BotInventoryDetailPanelProps {
  readonly decodedName: string;
  readonly bot: BotSnapshot | null;
  readonly showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function BotInventoryDetailPanel({ decodedName, bot, showToast }: BotInventoryDetailPanelProps) {
  const [inventory, setInventory] = useState<BotInventoryItem[]>([]);
  const [nearbyEntities, setNearbyEntities] = useState<BotNearbyEntity[]>([]);
  const [terrain, setTerrain] = useState<BotTerrainBlock[]>([]);
  const [detailOpen, setDetailOpen] = useState<'inventory' | 'entities' | 'terrain' | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);

  const fetchBotDetail = useCallback(async () => {
    if (!decodedName) return;
    setDetailLoading(true);
    try {
      const res = await botApi.getDetail(decodedName);
      setInventory(res.data.inventory);
      setNearbyEntities(res.data.nearbyEntities);
      setTerrain(res.data.terrain ?? []);
    } catch {
      showToast('获取详细信息失败', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [decodedName, showToast]);

  // Render terrain on canvas
  useEffect(() => {
    const canvas = terrainCanvasRef.current;
    if (!canvas || !terrain || terrain.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const xs = terrain.map((b) => b.x);
    const zs = terrain.map((b) => b.z);
    if (xs.length === 0 || zs.length === 0) return;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const rangeX = maxX - minX + 1;
    const rangeZ = maxZ - minZ + 1;
    const PIXEL = Math.max(1, Math.min(8, Math.floor(256 / Math.max(rangeX, rangeZ))));
    canvas.width = rangeX * PIXEL;
    canvas.height = rangeZ * PIXEL;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const block of terrain) {
      ctx.fillStyle = getColor(block.name);
      ctx.fillRect((block.x - minX) * PIXEL, (block.z - minZ) * PIXEL, PIXEL, PIXEL);
    }

    if (bot) {
      const bx = Math.round(bot.x) - minX;
      const bz = Math.round(bot.z) - minZ;
      ctx.fillStyle = '#ff3333';
      const markerSize = Math.max(PIXEL, 3);
      ctx.fillRect(bx * PIXEL - Math.floor(markerSize / 2), bz * PIXEL - Math.floor(markerSize / 2), markerSize, markerSize);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx * PIXEL - Math.floor(markerSize / 2), bz * PIXEL - Math.floor(markerSize / 2), markerSize, markerSize);
    }
  }, [terrain, bot]);

  return (
    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">背包 / 附近实体</h3>
        <button
          onClick={fetchBotDetail}
          disabled={detailLoading}
          className="ml-auto text-[10px] flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${detailLoading ? 'animate-spin' : ''}`} /> 刷新
        </button>
      </div>

      {/* Inventory Section */}
      <button
        onClick={() => { setDetailOpen(detailOpen === 'inventory' ? null : 'inventory'); if (!inventory.length) fetchBotDetail(); }}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mb-1"
      >
        {detailOpen === 'inventory' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Package className="w-3.5 h-3.5 text-amber-500" />
        <span>背包</span>
        <span className="ml-auto text-gray-400">{inventory.length} 物品</span>
      </button>
      {detailOpen === 'inventory' && (
        <div className="max-h-40 overflow-y-auto mb-1">
          {inventory.length === 0 ? (
            <p className="text-[10px] text-gray-400 px-2 py-1">暂无物品（点击刷新获取）</p>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="px-1 py-0.5">物品</th>
                  <th className="px-1 py-0.5 text-right">数量</th>
                  <th className="px-1 py-0.5 text-right">槽位</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.slot} className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <td className="px-1 py-0.5 truncate max-w-[120px]" title={item.name}>{item.displayName}</td>
                    <td className="px-1 py-0.5 text-right font-mono">{item.count}</td>
                    <td className="px-1 py-0.5 text-right text-gray-400">{item.slot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Nearby Entities Section */}
      <button
        onClick={() => { setDetailOpen(detailOpen === 'entities' ? null : 'entities'); if (!nearbyEntities.length) fetchBotDetail(); }}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mb-1"
      >
        {detailOpen === 'entities' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Users className="w-3.5 h-3.5 text-cyan-500" />
        <span>附近实体</span>
        <span className="ml-auto text-gray-400">{nearbyEntities.length} 个</span>
      </button>
      {detailOpen === 'entities' && (
        <div className="max-h-40 overflow-y-auto">
          {nearbyEntities.length === 0 ? (
            <p className="text-[10px] text-gray-400 px-2 py-1">未检测到附近实体（点击刷新获取）</p>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="px-1 py-0.5">名称</th>
                  <th className="px-1 py-0.5">类型</th>
                  <th className="px-1 py-0.5 text-right">距离</th>
                  <th className="px-1 py-0.5 text-right">HP</th>
                </tr>
              </thead>
              <tbody>
                {nearbyEntities.map((e) => (
                  <tr key={e.id} className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <td className="px-1 py-0.5 truncate max-w-[80px]" title={e.name ?? ''}>{e.name ?? `#${e.id}`}</td>
                    <td className="px-1 py-0.5 text-gray-400">{e.type}</td>
                    <td className="px-1 py-0.5 text-right font-mono">{e.distance}m</td>
                    <td className="px-1 py-0.5 text-right font-mono text-red-400">{e.health ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Terrain Map Section */}
      <button
        onClick={() => { setDetailOpen(detailOpen === 'terrain' ? null : 'terrain'); if (!terrain.length) fetchBotDetail(); }}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 mb-1"
      >
        {detailOpen === 'terrain' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Map className="w-3.5 h-3.5 text-emerald-500" />
        <span>周围地形</span>
        <span className="ml-auto text-gray-400">{terrain.length > 0 ? `${terrain.length} 方块` : ''}</span>
      </button>
      {detailOpen === 'terrain' && (
        <div className="flex flex-col items-center gap-1 p-1">
          {terrain.length === 0 ? (
            <p className="text-[10px] text-gray-400">暂无地形数据（点击刷新获取）</p>
          ) : (
            <>
              <canvas
                ref={terrainCanvasRef}
                className="border border-gray-600 rounded"
                style={{ imageRendering: 'pixelated', width: '100%', maxWidth: 256, aspectRatio: '1/1' }}
              />
              <div className="flex flex-wrap gap-2 text-[9px] text-gray-400">
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#5d9b3a' }} />草地</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#888888' }} />石头</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#3366cc' }} />水</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#6b5030' }} />木</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#e8d68a' }} />沙</span>
                <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-red-500" />机器人</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
