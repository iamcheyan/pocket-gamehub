export interface Game { id: number | string; title: string; platform?: string; developer?: string; publisher?: string; genre?: string; description?: string; release_date?: string; cover_url?: string; play_time?: number; play_count?: number; favorite?: boolean; metadata_status?: string }
export interface Collection { id: number | string; name: string; description?: string; game_ids?: Array<number | string>; games?: Game[] }
export interface Health { emulator?: string; emulator_detail?: string; emulator_available?: boolean; retroarch_available?: boolean; emulator_version?: string; retroarch_version?: string; metadata_provider?: string; provider?: string; metadata_mock?: boolean; mock?: boolean }
export interface GameAPI { health(): Promise<Health>; home(): Promise<Record<string, unknown>>; games(params?: { q?: string; platform?: string }): Promise<Game[]>; game(id: Game['id']): Promise<Game>; search(q: string): Promise<Game[]>; launch(id: Game['id']): Promise<unknown>; history(): Promise<unknown[]> }
export interface StorageAPI { platforms(): Promise<Array<{ name: string; count?: number; game_count?: number }>>; collections(): Promise<Collection[]>; collection(id: Collection['id']): Promise<Collection>; createCollection(name: string): Promise<Collection>; addCollectionGame(collectionId: Collection['id'], gameId: Game['id']): Promise<unknown>; removeCollectionGame(collectionId: Collection['id'], gameId: Game['id']): Promise<unknown>; settings(): Promise<Record<string, unknown>>; saveSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>>; scan(): Promise<unknown>; scanStatus(): Promise<Record<string, unknown>>; scrape(): Promise<unknown> }
export interface MediaAPI { cover(id: Game['id']): string; screenshots(id: Game['id']): Promise<string[]> }
export interface SystemAPI { launchAvailable(health: Health): boolean }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' && 'message' in payload.error && typeof payload.error.message === 'string') throw new Error(payload.error.message);
    throw new Error(`Request failed (${response.status})`);
  }
  return payload as T;
}
async function requestList<T>(path: string): Promise<T[]> {
  const result: unknown = await request(path);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'items' in result && Array.isArray(result.items)) return result.items as T[];
  return [];
}
function asCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    if ('collection' in item && item.collection && typeof item.collection === 'object') return [item.collection as Collection];
    if ('id' in item && 'name' in item) return [item as Collection];
    return [];
  });
}
function queryString(params: { q?: string; platform?: string }) {
  const values = new URLSearchParams();
  if (params.q) values.set('q', params.q);
  if (params.platform) values.set('platform', params.platform);
  const encoded = values.toString();
  return encoded ? `?${encoded}` : '';
}
export const GameAPI: GameAPI = {
  health: () => request('/health'), home: () => request('/home'), games: (params = {}) => requestList<Game>(`/games${queryString(params)}`),
  game: async id => { const result: unknown = await request(`/games/${encodeURIComponent(id)}`); if (Array.isArray(result)) return result[0] as Game; return result as Game; },
  search: q => requestList<Game>(`/search?q=${encodeURIComponent(q)}`),
  launch: id => request('/launch', { method: 'POST', body: JSON.stringify({ game_id: id }) }), history: () => requestList('/history?limit=20'),
};
export const StorageAPI: StorageAPI = {
  platforms: () => requestList('/platforms'), collections: async () => asCollections(await request('/collections')),
  addCollectionGame: (collectionId, gameId) => request(`/collections/${encodeURIComponent(collectionId)}/games`, { method: 'POST', body: JSON.stringify({ game_id: gameId }) }),
  collection: async id => { const value: unknown = await request(`/collections/${encodeURIComponent(id)}`); if (value && typeof value === 'object' && 'games' in value) return { id, name: String(id), games: Array.isArray(value.games) ? value.games as Game[] : [] }; return value as Collection; },
  createCollection: async name => { const value: unknown = await request('/collections', { method: 'POST', body: JSON.stringify({ name }) }); if (value && typeof value === 'object' && 'id' in value && 'name' in value) return value as Collection; return { id: name, name }; },
  removeCollectionGame: (collectionId, gameId) => request(`/collections/${encodeURIComponent(collectionId)}/games`, { method: 'DELETE', body: JSON.stringify({ game_id: gameId }) }),
  settings: async () => { const value: unknown = await request('/settings'); if (value && typeof value === 'object' && 'settings' in value && value.settings && typeof value.settings === 'object') return value.settings as Record<string, unknown>; return value as Record<string, unknown>; },
  saveSettings: settings => request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  scan: () => request('/scan', { method: 'POST', body: '{}' }), scanStatus: () => request('/scan/status'),
  scrape: () => request('/metadata/scrape', { method: 'POST', body: JSON.stringify({ all: true }) }),
};
export const MediaAPI: MediaAPI = { cover: id => `/api/cover/${encodeURIComponent(id)}`, screenshots: id => requestList(`/screenshots/${encodeURIComponent(id)}`) };
export const SystemAPI: SystemAPI = { launchAvailable: health => health.emulator_available ?? health.retroarch_available ?? health.emulator === 'available' };
export async function setFavorite(game: Game) {
  const id = encodeURIComponent(game.id);
  return request(game.favorite ? `/favorites/${id}` : '/favorites', game.favorite ? { method: 'DELETE' } : { method: 'POST', body: JSON.stringify({ game_id: game.id }) });
}
