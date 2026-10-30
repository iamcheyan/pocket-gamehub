import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameAPI, MediaAPI, StorageAPI, SystemAPI, setFavorite, type Collection, type Game, type Health } from './api';
import { localeFrom, messages, type Locale, type MessageKey } from './i18n';
import { pressedButtonMask, resolveAction, risingEdgeButtons } from './input';
import { Gamepad2, GamepadDirectional, Heart, Home, Library, ListFilter, Search, Settings, Sparkles, Star, X, Clock3, Plus, ScanLine, Languages, SunMoon, ChevronLeft, Play, Gamepad, Layers } from 'lucide-react';

type Route = 'home' | 'library' | 'search' | 'collections' | 'settings';
const navigation: Array<{ route: Route; key: MessageKey; icon: typeof Home }> = [{ route: 'home', key: 'home', icon: Home }, { route: 'library', key: 'library', icon: Library }, { route: 'search', key: 'search', icon: Search }, { route: 'collections', key: 'collections', icon: Layers }, { route: 'settings', key: 'settings', icon: Settings }];
const CONTROL_ROWS: ReadonlyArray<{ glyph: string; key: MessageKey }> = [
  { glyph: 'A', key: 'buttonA' },
  { glyph: 'B', key: 'buttonB' },
  { glyph: 'X', key: 'buttonX' },
  { glyph: 'Y', key: 'buttonY' },
  { glyph: 'D-Pad', key: 'dpad' },
  { glyph: 'START', key: 'start' },
  { glyph: 'SELECT', key: 'select' },
  { glyph: 'MENU', key: 'menu' },
  { glyph: 'L1 · R1', key: 'shoulder' },
  { glyph: 'L2 · R2', key: 'triggers' },
];
function getError(error: unknown) { return error instanceof Error ? error.message : ''; }
function prettyTime(minutes?: number) { if (!minutes) return '—'; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours ? `${hours}h ${rest}m` : `${rest}m`; }
function coverColor(game: Game) { const colors = ['#e88154', '#61a3a0', '#aa82c6', '#d4a543', '#597fc4', '#c36679']; let value = 0; for (const character of String(game.id)) value += character.charCodeAt(0); return colors[value % colors.length]; }
function collectionGames(collection: Collection, library: Game[]) { if (collection.games) return collection.games; const ids = collection.game_ids; if (ids) return library.filter(game => ids.some(id => String(id) === String(game.id))); return []; }

export function App() {
  const [route, setRoute] = useState<Route>('home');
  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Array<{ name: string; count?: number }>>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [health, setHealth] = useState<Health>({});
  const [selected, setSelected] = useState<Game | null>(null);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [category, setCategory] = useState('allGames');
  const [collectionId, setCollectionId] = useState<Collection['id'] | null>(null);
  const [locale, setLocale] = useState<Locale>('en');
  const [theme, setTheme] = useState('system');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const t = useCallback((key: MessageKey) => messages[locale][key], [locale]);
  const load = useCallback(async () => {
    setError('');
    try {
      const [library, systemPlatforms, userCollections, systemHealth, settings] = await Promise.all([GameAPI.games(), StorageAPI.platforms(), StorageAPI.collections(), GameAPI.health(), StorageAPI.settings()]);
      setGames(library); setPlatforms(systemPlatforms.map(item => ({ ...item, count: item.count ?? item.game_count }))); setCollections(userCollections); setHealth(systemHealth);
      if (settings.language) setLocale(localeFrom(settings.language));
      if (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'system') setTheme(settings.theme);
    } catch (reason) { setError(getError(reason)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
      root.dataset.theme = resolved;
      root.classList.toggle('light', resolved === 'light');
    };
    apply(); const media = matchMedia('(prefers-color-scheme: light)'); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  async function openGame(game: Game) { try { setSelected(await GameAPI.game(game.id)); } catch { setSelected(game); } }
  async function favorite(game: Game) {
    try { await setFavorite(game); const updated = { ...game, favorite: !game.favorite }; setGames(items => items.map(item => item.id === game.id ? updated : item)); if (selected?.id === game.id) setSelected(updated); }
    catch (reason) { setError(getError(reason)); }
  }
  async function launch(game: Game) {
    if (!SystemAPI.launchAvailable(health)) { setNotice(t('unavailableDetail')); return; }
    try { await GameAPI.launch(game.id); setNotice(t('ready')); } catch (reason) { setError(getError(reason)); }
  }
  async function search(value: string) {
    setQuery(value);
    try { setGames(value.trim() ? await GameAPI.search(value) : await GameAPI.games()); if (value.trim()) setRoute('search'); }
    catch (reason) { setError(getError(reason)); }
  }
  async function saveSetting(name: string, value: string) {
    try { await StorageAPI.saveSettings({ [name]: value }); if (name === 'language') setLocale(localeFrom(value)); if (name === 'theme') setTheme(value); }
    catch (reason) { setError(getError(reason)); }
  }
  async function scan() { setBusy(true); try { await StorageAPI.scan(); setNotice(t('scanning')); window.setTimeout(() => void StorageAPI.scanStatus().then(() => load()).catch(() => undefined), 800); } catch (reason) { setError(getError(reason)); } finally { setBusy(false); } }
  async function scrape() { setBusy(true); try { await StorageAPI.scrape(); setNotice(t('ready')); await load(); } catch (reason) { setError(getError(reason)); } finally { setBusy(false); } }
  async function createCollection() {
    const name = window.prompt(t('collectionName'));
    if (!name?.trim()) return;
    try { await StorageAPI.createCollection(name.trim()); setCollections(await StorageAPI.collections()); } catch (reason) { setError(getError(reason)); }
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) { if (event.key === 'Escape') { target.blur(); if (selected) setSelected(null); } return; }
      if (['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key)) {
        const items = Array.from(document.querySelectorAll<HTMLElement>('[data-focusable]'));
        const current = items.indexOf(document.activeElement as HTMLElement);
        const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
        items[(current + delta + items.length) % items.length]?.focus(); event.preventDefault();
      } else if (event.key === 'Escape' || event.key.toLowerCase() === 'b') { if (selected) setSelected(null); else setRoute('home'); }
      else if (event.key === 'm' || event.key === 'Tab') { setShowControls(value => !value); if (event.key === 'Tab') event.preventDefault(); }
      else {
        const id = document.activeElement?.closest<HTMLElement>('[data-game-id]')?.dataset.gameId;
        const game = games.find(item => String(item.id) === id);
        if ((event.key === 'f' || event.key.toLowerCase() === 'x') && game) void favorite(game);
        else if ((event.key.toLowerCase() === 'i' || event.key.toLowerCase() === 'y') && game) void openGame(game);
        else if ((event.key === ' ' || event.key.toLowerCase() === 'a') && game) void launch(game);
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [games, selected]);
  useEffect(() => {
    let frame = 0; let lastAction = 0; let previous = 0;
    const moveFocus = (direction: number) => {
      const items = Array.from(document.querySelectorAll<HTMLElement>('[data-focusable]'));
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      items[(current + direction + items.length) % items.length]?.focus();
    };
    const shiftRoute = (direction: number) => setRoute(current => {
      const index = navigation.findIndex(item => item.route === current);
      return navigation[(index + direction + navigation.length) % navigation.length].route;
    });
    const poll = () => {
      const pad = navigator.getGamepads?.()[0];
      if (pad) {
        const pressed = pressedButtonMask(pad);
        const now = performance.now();
        for (const button of risingEdgeButtons(pressed, previous)) {
          const action = resolveAction(button, now, lastAction);
          if (!action) continue;
          const id = document.activeElement?.closest<HTMLElement>('[data-game-id]')?.dataset.gameId;
          const game = games.find(item => String(item.id) === id);
          switch (action) {
            case 'activate': (document.activeElement as HTMLElement | null)?.click(); break;
            case 'cancel': setSelected(null); break;
            case 'favorite': if (game) void favorite(game); break;
            case 'open': if (game) void openGame(game); break;
            case 'launch': if (game) void launch(game); break;
            case 'help': setShowControls(value => !value); break;
            case 'previous': moveFocus(-1); break;
            case 'next': moveFocus(1); break;
            case 'previousNav': shiftRoute(-1); break;
            case 'nextNav': shiftRoute(1); break;
          }
          lastAction = now;
        }
        previous = pressed;
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll); return () => cancelAnimationFrame(frame);
  }, [games]);
  const shown = useMemo(() => {
    let list = [...games];
    const collection = collections.find(item => String(item.id) === String(collectionId));
    if (collection) { const members = collectionGames(collection, games); list = list.filter(game => members.some(member => String(member.id) === String(game.id))); }
    if (platform) list = list.filter(game => game.platform === platform);
    if (category === 'favorites') list = list.filter(game => game.favorite);
    if (category === 'recentlyPlayed') list = list.filter(game => Number(game.play_count) > 0).sort((a,b) => Number(b.play_count)-Number(a.play_count));
    if (category === 'recentlyAdded') list = [...list].reverse();
    return list;
  }, [games, platform, category, collectionId, collections]);
  const title = t(route); const filtered = route === 'search' && !query.trim() ? games : shown;
  function Card({ game }: { game: Game }) {
    return <article className="game-card" data-focusable tabIndex={0} data-game-id={game.id} onClick={() => void openGame(game)} onKeyDown={event => { if (event.key === 'Enter') void openGame(game); }}><div className="cover" style={{ '--cover': coverColor(game) } as React.CSSProperties}>{game.cover_url ? <img src={MediaAPI.cover(game.id)} alt="" loading="lazy" /> : <><span className="cover-mark">{game.title.slice(0,1)}</span><span className="cover-title">{game.title}</span></>}{game.favorite && <Heart size="1em" fill="currentColor" className="cover-heart" />}</div><strong>{game.title}</strong><span>{game.platform || '—'}</span></article>;
  }
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-icon"><Gamepad2 /></span><span>{t('app')}</span></div><nav>{navigation.map(({ route: destination, key, icon: Icon }) => <button data-focusable className={`nav-item ${route === destination ? 'active' : ''}`} key={destination} onClick={() => { setSelected(null); setRoute(destination); setPlatform(''); setCollectionId(null); setQuery(''); void load(); }}><Icon size="1.15em"/><span>{t(key)}</span></button>)}</nav><div className="side-bottom"><button className="guide-link" data-focusable onClick={() => setShowControls(true)}><Gamepad size="1.1em"/>{t('inputGuide')}</button><div className="health-pill"><i className={!SystemAPI.launchAvailable(health) ? 'offline' : ''}/><span>{SystemAPI.launchAvailable(health) ? t('ready') : t('unavailable')}</span></div></div></aside>
    <main className="main"><header className="topbar"><button className="mobile-brand" onClick={() => setRoute('home')}><Gamepad2 /> {t('app')}</button><div className="breadcrumb">{t('app')} <span>/</span> {title}{platform && <><span>/</span>{platform}</>}</div><label className="searchbar"><Search size="1.1em"/><input value={query} onChange={event => void search(event.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('search')}/><kbd>⌘ K</kbd></label><button className="icon-button" aria-label={t('inputGuide')} onClick={() => setShowControls(true)}><Gamepad2/></button></header>
      <div className="content">{error && <div className="notice error" role="alert">{t('error')}: {error}<button onClick={() => setError('')}><X/></button></div>}{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')}><X/></button></div>}
        {selected ? <section className="detail-view"><button className="text-button" onClick={() => setSelected(null)}><ChevronLeft/>{t('back')}</button><div className="detail-layout"><div className="detail-cover cover" style={{ '--cover': coverColor(selected) } as React.CSSProperties}>{selected.cover_url ? <img src={MediaAPI.cover(selected.id)} alt=""/> : <><span className="cover-mark">{selected.title.slice(0,1)}</span><span className="cover-title">{selected.title}</span></>}</div><div className="detail-copy"><span className="eyebrow">{selected.platform || '—'}</span><h1>{selected.title}</h1><p>{selected.description || ''}</p><div className="metadata-grid">{([[t('genre'),selected.genre],[t('releaseDate'),selected.release_date],[t('developer'),selected.developer],[t('publisher'),selected.publisher],[t('playTime'),prettyTime(selected.play_time)],[t('playCount'),selected.play_count]] as Array<[string,unknown]>).map(([key,value]) => <div key={key}><span>{key}</span><strong>{value == null || value === '' ? '—' : String(value)}</strong></div>)}</div><div className="detail-actions"><button className="primary-button" data-focusable onClick={() => void launch(selected)} disabled={!SystemAPI.launchAvailable(health)}><Play fill="currentColor"/>{SystemAPI.launchAvailable(health) ? t('launch') : t('unavailable')}</button><button className="secondary-button" data-focusable onClick={() => void favorite(selected)}><Heart fill={selected.favorite ? 'currentColor' : 'none'}/>{selected.favorite ? t('removeFavorite') : t('favorite')}</button></div>{!SystemAPI.launchAvailable(health) && <p className="muted">{health.emulator_detail || t('unavailableDetail')}</p>}</div></div></section>
        : route === 'settings' ? <section><SectionTitle icon={Settings} title={t('settings')} subtitle={t('appearance')}/><div className="settings-grid"><SettingsCard icon={SunMoon} title={t('theme')}><div className="segmented">{(['light','dark','system'] as const).map(value => <button key={value} data-focusable className={theme === value ? 'chosen' : ''} onClick={() => void saveSetting('theme',value)}>{t(value)}</button>)}</div></SettingsCard><SettingsCard icon={Languages} title={t('language')}><div className="segmented">{([['en','English'],['zh','简体中文'],['ja','日本語']] as const).map(([value,label]) => <button key={value} data-focusable className={locale === value ? 'chosen' : ''} onClick={() => void saveSetting('language',value)}>{label}</button>)}</div></SettingsCard><SettingsCard icon={ScanLine} title={t('scanPath')}><p>{t('scanStatus')}</p><button data-focusable className="secondary-button" disabled={busy} onClick={() => void scan()}><ScanLine/>{t('scan')}</button></SettingsCard><SettingsCard icon={Sparkles} title={t('metadataProvider')}><p>{health.metadata_provider || health.provider || '—'}{health.metadata_mock || health.mock ? ' · Mock' : ''}</p><button data-focusable className="secondary-button" disabled={busy} onClick={() => void scrape()}><Sparkles/>{t('scanMetadata')}</button></SettingsCard><SettingsCard icon={Gamepad2} title={t('emulatorStatus')}><p>{SystemAPI.launchAvailable(health) ? health.emulator_version || health.retroarch_version || t('ready') : health.emulator_detail || t('unavailableDetail')}</p></SettingsCard><SettingsCard icon={GamepadDirectional} title={t('inputGuide')}><button className="secondary-button" data-focusable onClick={() => setShowControls(true)}><Gamepad/>{t('controls')}</button></SettingsCard></div></section>
        : route === 'collections' ? <section><SectionTitle icon={Layers} title={t('collections')} subtitle={t('homeCollections')}><button className="secondary-button" data-focusable onClick={() => void createCollection()}><Plus/>{t('createCollection')}</button></SectionTitle><div className="collection-grid">{collections.map(collection => <button data-focusable className="collection-card" key={collection.id} onClick={async () => { try { const detail = await StorageAPI.collection(collection.id); setCollections(items => items.map(item => item.id === collection.id ? detail : item)); setCollectionId(collection.id); setCategory('allGames'); setPlatform(''); setRoute('library'); } catch (reason) { setError(getError(reason)); } }}><div className="collection-art"><Layers/></div><strong>{collection.name}</strong><span>{collection.games?.length || collection.game_ids?.length || 0} · {t('allGames')}</span></button>)}</div>{!collections.length && <Empty title={t('collections')} text={t('libraryEmpty')}/>}</section>
        : <section><SectionTitle icon={route === 'home' ? Home : route === 'search' ? Search : Library} title={route === 'search' ? t('search') : route === 'library' ? (platform || collections.find(item => String(item.id) === String(collectionId))?.name || t('library')) : t('home')} subtitle={route === 'home' ? t('continuePlaying') : platform || t('allGames')}><span className="game-count">{filtered.length} · {t('allGames')}</span></SectionTitle>{route === 'home' && <><div className="hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size="1em"/>{t('continuePlaying')}</span><h2>{games.find(game => Number(game.play_count) > 0)?.title || t('libraryEmpty')}</h2><p>{games.find(game => Number(game.play_count) > 0)?.platform || t('libraryEmpty')}</p><button className="primary-button" data-focusable onClick={() => { const game = games.find(item => Number(item.play_count) > 0) || games[0]; if (game) void openGame(game); }}>{t('play')} <ChevronLeft className="arrow-right"/></button></div><div className="hero-art"><div className="hero-disc"/><Gamepad2/></div></div><div className="quick-links"><button data-focusable onClick={() => { setCategory('recentlyPlayed'); setRoute('library'); }}><Clock3/><span>{t('recentlyPlayed')}</span><ChevronLeft className="arrow-right"/></button><button data-focusable onClick={() => { setCategory('favorites'); setRoute('library'); }}><Heart/><span>{t('favorites')}</span><ChevronLeft className="arrow-right"/></button><button data-focusable onClick={() => setRoute('collections')}><Layers/><span>{t('collections')}</span><ChevronLeft className="arrow-right"/></button></div><div className="section-row"><h2><Star/>{t('recentlyAdded')}</h2><button data-focusable onClick={() => setRoute('library')}>{t('allGames')}<ChevronLeft className="arrow-right"/></button></div></>}
          {route === 'library' && <div className="library-toolbar"><div className="filter-select"><ListFilter/><select aria-label={t('platforms')} value={platform} onChange={event => { setPlatform(event.target.value); setCollectionId(null); }}><option value="">{t('allPlatforms')}</option>{platforms.map(item => <option value={item.name} key={item.name}>{item.name} {item.count ? `(${item.count})` : ''}</option>)}</select></div><div className="category-tabs">{(['allGames','favorites','recentlyPlayed','recentlyAdded'] as const).map(value => <button data-focusable className={category === value ? 'chosen' : ''} onClick={() => setCategory(value)} key={value}>{t(value)}</button>)}</div></div>}
          {route === 'library' && !platform && !collectionId && <div className="platform-row">{platforms.map(item => <button data-focusable className="platform-chip" key={item.name} onClick={() => setPlatform(item.name)}>{item.name}<span>{item.count || games.filter(game => game.platform === item.name).length}</span></button>)}</div>}
          <div className="game-grid">{filtered.slice(0, route === 'home' ? 8 : undefined).map(game => <Card key={game.id} game={game}/>)}</div>{!filtered.length && <Empty title={t('noGames')} text={error || t('libraryEmpty')}/>}</section>}
      </div><footer className="statusbar"><span><i className={!SystemAPI.launchAvailable(health) ? 'offline' : ''}/>{SystemAPI.launchAvailable(health) ? t('ready') : t('unavailable')}</span><span>{t('navigationHint')}</span></footer>
    </main>
    {showControls && <div className="modal-backdrop" onClick={() => setShowControls(false)}><section className="control-modal" role="dialog" aria-modal="true" aria-labelledby="control-heading" onClick={event => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow"><Gamepad2/>{t('inputGuide')}</span><h2 id="control-heading">{t('controls')}</h2></div><button aria-label={t('close')} onClick={() => setShowControls(false)}><X/></button></div><p className="muted">{t('navigationHint')}</p><div className="mapping-list">{CONTROL_ROWS.map(({ glyph, key }) => <div key={key}><kbd>{glyph}</kbd><span>{t(key)}</span></div>)}</div><button className="primary-button" onClick={() => setShowControls(false)}>{t('close')}</button></section></div>}
  </div>;
}
function SectionTitle({ icon: Icon, title, subtitle, children }: { icon: typeof Home; title: string; subtitle: string; children?: React.ReactNode }) { return <div className="section-title"><div><span className="eyebrow"><Icon size="1em"/>{subtitle}</span><h1>{title}</h1></div>{children}</div>; }
function SettingsCard({ icon: Icon, title, children }: { icon: typeof Home; title: string; children: React.ReactNode }) { return <div className="settings-card"><span className="settings-icon"><Icon/></span><div><h3>{title}</h3>{children}</div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty-state"><div><Gamepad2/></div><strong>{title}</strong><span>{text}</span></div>; }
