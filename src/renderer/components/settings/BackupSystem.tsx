import { useState, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { AppleToggle } from '../AppleToggle';
import { useI18n } from '../../../i18n/useI18n';
import type { Theme, Song, PresentationDeck, Scene, BibleVerse, LiveScriptureState, TranscriptionState } from '../../types';

export interface BackupOptions {
  themes: boolean;
  songs: boolean;
  presentations: boolean;
  scenes: boolean;
  history: boolean;
  settings: boolean;
}

export interface BackupPackage {
  appName: string;
  version: string;
  timestamp: number;
  exportDate: string;
  data: {
    themes?: Theme[];
    activeThemeId?: string | null;
    songs?: Song[];
    presentationDecks?: PresentationDeck[];
    scenes?: Scene[];
    verseHistory?: BibleVerse[];
    liveScripture?: LiveScriptureState;
    transcription?: TranscriptionState;
  };
}

export function BackupSystem() {
  const { t } = useI18n();
  const store = useAppStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [options, setOptions] = useState<BackupOptions>({
    themes: true,
    songs: true,
    presentations: true,
    scenes: true,
    history: true,
    settings: true,
  });

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInputText, setResetInputText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ pkg: BackupPackage; file: File } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const toggleOption = (key: keyof BackupOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = (select: boolean) => {
    setOptions({
      themes: select,
      songs: select,
      presentations: select,
      scenes: select,
      history: select,
      settings: select,
    });
  };

  const handleExportBackup = () => {
    setIsExporting(true);
    try {
      const dataPayload: BackupPackage['data'] = {};

      if (options.themes) {
        dataPayload.themes = store.themes;
        dataPayload.activeThemeId = store.activeTheme?.id || null;
      }
      if (options.songs) {
        dataPayload.songs = store.songs;
      }
      if (options.presentations) {
        dataPayload.presentationDecks = store.presentationDecks;
      }
      if (options.scenes) {
        dataPayload.scenes = store.scenes;
      }
      if (options.history) {
        dataPayload.verseHistory = store.verseHistory;
      }
      if (options.settings) {
        dataPayload.liveScripture = store.liveScripture;
        dataPayload.transcription = store.transcription;
      }

      const pkg: BackupPackage = {
        appName: 'Bible Song Pro Studio',
        version: '3.1.0',
        timestamp: Date.now(),
        exportDate: new Date().toLocaleDateString('en-US', { dateStyle: 'full' }),
        data: dataPayload,
      };

      const jsonStr = JSON.stringify(pkg, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `bible-song-pro-backup-${dateStr}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({ type: 'success', text: t('settings.backup.exportSuccess', { filename }) });
    } catch (err) {
      console.error('Backup export failed:', err);
      setStatusMessage({ type: 'error', text: t('settings.backup.exportError') });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as BackupPackage;
        if (!parsed || !parsed.data) {
          throw new Error('Invalid backup file format.');
        }
        setImportSummary({ pkg: parsed, file });
      } catch (err) {
        console.error('Failed to parse backup:', err);
        setStatusMessage({ type: 'error', text: t('settings.backup.invalidFile') });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importSummary) return;
    try {
      const { pkg } = importSummary;
      const d = pkg.data;

      if (Array.isArray(d.themes) && d.themes.length > 0) {
        const themeMap = new Map<string, Theme>();
        store.themes.forEach((theme: Theme) => themeMap.set(theme.id, theme));
        d.themes.forEach((theme: Theme) => themeMap.set(theme.id, theme));
        const mergedThemes = Array.from(themeMap.values());
        useAppStore.setState({ themes: mergedThemes });
        if (d.activeThemeId) {
          const active = mergedThemes.find((theme: Theme) => theme.id === d.activeThemeId);
          if (active) store.setActiveTheme(active);
        }
      }

      if (Array.isArray(d.songs) && d.songs.length > 0) {
        const songMap = new Map<string, Song>();
        store.songs.forEach((s: Song) => songMap.set(s.id, s));
        d.songs.forEach((s: Song) => songMap.set(s.id, s));
        store.setSongs(Array.from(songMap.values()));
      }

      if (Array.isArray(d.presentationDecks) && d.presentationDecks.length > 0) {
        const deckMap = new Map<string, PresentationDeck>();
        store.presentationDecks.forEach((deck: PresentationDeck) => deckMap.set(deck.id, deck));
        d.presentationDecks.forEach((deck: PresentationDeck) => deckMap.set(deck.id, deck));
        store.setPresentationDecks(Array.from(deckMap.values()));
      }

      if (Array.isArray(d.scenes) && d.scenes.length > 0) {
        useAppStore.setState({ scenes: d.scenes });
      }

      if (Array.isArray(d.verseHistory) && d.verseHistory.length > 0) {
        useAppStore.setState({ verseHistory: d.verseHistory });
      }

      if (d.liveScripture) store.setLiveScripture(d.liveScripture);
      if (d.transcription) store.setTranscription(d.transcription);

      setStatusMessage({ type: 'success', text: t('settings.backup.importSuccess') });
      setImportSummary(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Import error:', err);
      setStatusMessage({ type: 'error', text: t('settings.backup.importError') });
    }
  };

  const handleFactoryReset = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();

      if (window.BSP?.store?.clear) {
        await window.BSP.store.clear().catch(() => {});
      }
      const bspSettings = window.BSP?.settings as unknown as { reset?: () => Promise<unknown> };
      if (bspSettings?.reset) {
        await bspSettings.reset().catch(() => {});
      }

      window.location.reload();
    } catch (err) {
      console.error('Reset error:', err);
      window.location.reload();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {statusMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: statusMessage.type === 'success' ? 'rgba(46, 204, 113, 0.15)' : statusMessage.type === 'error' ? 'rgba(231, 76, 60, 0.15)' : 'rgba(52, 152, 219, 0.15)',
            border: `1px solid ${statusMessage.type === 'success' ? '#2ecc71' : statusMessage.type === 'error' ? '#e74c3c' : '#3498db'}`,
            color: statusMessage.type === 'success' ? '#2ecc71' : statusMessage.type === 'error' ? '#e74c3c' : '#3498db',
          }}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          background: 'var(--settings-card)',
          border: '1px solid var(--settings-line)',
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {t('settings.backup.exportTitle')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {t('settings.backup.exportSub')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => toggleAll(true)}
              style={{ background: 'var(--chrome-control)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
            >
              {t('settings.backup.selectAll')}
            </button>
            <button
              onClick={() => toggleAll(false)}
              style={{ background: 'var(--chrome-control)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
            >
              {t('settings.backup.deselectAll')}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: 10, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.7-.72 1.7-1.61 0-.43-.17-.83-.44-1.14-.24-.28-.39-.64-.39-1.04 0-.88.72-1.6 1.6-1.6H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z"/></svg>
                {t('settings.backup.themesTitle')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.backup.themesSub', { count: store.themes.length })}</div>
            </div>
            <AppleToggle checked={options.themes} onChange={() => toggleOption('themes')} />
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: 10, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                {t('settings.backup.songsTitle')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.backup.songsSub', { count: store.songs.length })}</div>
            </div>
            <AppleToggle checked={options.songs} onChange={() => toggleOption('songs')} />
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: 10, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                {t('settings.backup.presentationsTitle')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.backup.presentationsSub', { count: store.presentationDecks.length })}</div>
            </div>
            <AppleToggle checked={options.presentations} onChange={() => toggleOption('presentations')} />
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: 10, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                {t('settings.backup.scenesTitle')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.backup.scenesSub', { count: store.scenes.length })}</div>
            </div>
            <AppleToggle checked={options.scenes} onChange={() => toggleOption('scenes')} />
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: 10, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                {t('settings.backup.settingsTitle')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.backup.settingsSub')}</div>
            </div>
            <AppleToggle checked={options.settings} onChange={() => toggleOption('settings')} />
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: 10, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {t('settings.backup.historyTitle')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.backup.historySub', { count: store.verseHistory.length })}</div>
            </div>
            <AppleToggle checked={options.history} onChange={() => toggleOption('history')} />
          </div>
        </div>

        <button
          onClick={handleExportBackup}
          disabled={isExporting || !Object.values(options).some(Boolean)}
          style={{
            width: '100%',
            height: 38,
            background: Object.values(options).some(Boolean) ? '#FF5500' : '#262628',
            border: 'none',
            borderRadius: 6,
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 13,
            cursor: Object.values(options).some(Boolean) ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {isExporting ? t('settings.backup.exporting') : t('settings.backup.exportButton')}
        </button>
      </div>

      <div
        style={{
          background: 'var(--settings-card)',
          border: '1px solid var(--settings-line)',
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('settings.backup.importTitle')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {t('settings.backup.importSub')}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.bspbackup"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            height: 38,
            background: 'var(--bg-secondary)',
            border: '1px dashed #FF5500',
            borderRadius: 6,
            color: '#FF5500',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          {t('settings.backup.chooseFile')}
        </button>

        {importSummary && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: 'var(--settings-card)',
              borderRadius: 8,
              border: '1px solid rgba(255, 85, 0, 0.3)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {t('settings.backup.packageDetected', { filename: importSummary.file.name })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {t('settings.backup.packageMeta', {
                date: importSummary.pkg.exportDate || t('settings.backup.unknownDate'),
                version: importSummary.pkg.version || '3.1.0',
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {importSummary.pkg.data.themes && <div>{t('settings.backup.summaryThemes', { count: importSummary.pkg.data.themes.length })}</div>}
              {importSummary.pkg.data.songs && <div>{t('settings.backup.summarySongs', { count: importSummary.pkg.data.songs.length })}</div>}
              {importSummary.pkg.data.presentationDecks && <div>{t('settings.backup.summaryDecks', { count: importSummary.pkg.data.presentationDecks.length })}</div>}
              {importSummary.pkg.data.scenes && <div>{t('settings.backup.summaryScenes', { count: importSummary.pkg.data.scenes.length })}</div>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleConfirmImport}
                style={{ flex: 1, height: 34, background: '#2ecc71', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                {t('settings.backup.confirmImport')}
              </button>
              <button
                onClick={() => setImportSummary(null)}
                style={{ height: 34, padding: '0 14px', background: '#202024', border: '1px solid #262628', borderRadius: 6, color: '#a1a1aa', fontWeight: 600, cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          background: 'rgba(231, 76, 60, 0.08)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
          borderRadius: 10,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e74c3c', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {t('settings.backup.resetTitle')}
        </div>
        <div style={{ fontSize: 12, color: '#e0a0a0', lineHeight: 1.5, marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            {t('settings.backup.resetWarning')}
            <br />
            <span style={{ color: '#ffffff', fontWeight: 600 }}>{t('settings.backup.resetEncourage')}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleExportBackup}
            style={{
              flex: 1,
              height: 38,
              background: 'rgba(255, 85, 0, 0.15)',
              border: '1px solid #FF5500',
              borderRadius: 6,
              color: '#FF5500',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {t('settings.backup.exportFirst')}
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              flex: 1,
              height: 38,
              background: '#e74c3c',
              border: 'none',
              borderRadius: 6,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            {t('settings.backup.resetButton')}
          </button>
        </div>
      </div>

      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#141416',
              border: '2px solid #e74c3c',
              borderRadius: 12,
              padding: 24,
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
              color: '#ffffff',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e74c3c', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {t('settings.backup.confirmResetTitle')}
            </div>
            <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, marginBottom: 16 }}>
              {t('settings.backup.confirmResetBody')}
            </div>

            <div style={{ fontSize: 12, color: '#ffffff', fontWeight: 600, marginBottom: 6 }}>
              {t('settings.backup.typeReset')}
            </div>

            <input
              className="input"
              type="text"
              value={resetInputText}
              onChange={(e) => setResetInputText(e.target.value)}
              placeholder={t('settings.backup.resetPlaceholder')}
              style={{ width: '100%', height: 38, marginBottom: 16, textAlign: 'center', fontSize: 14, fontWeight: 700, letterSpacing: 2 }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled={resetInputText.trim().toUpperCase() !== 'RESET'}
                onClick={handleFactoryReset}
                style={{
                  flex: 1,
                  height: 40,
                  background: resetInputText.trim().toUpperCase() === 'RESET' ? '#e74c3c' : '#331a1a',
                  border: 'none',
                  borderRadius: 6,
                  color: resetInputText.trim().toUpperCase() === 'RESET' ? '#ffffff' : '#664444',
                  fontWeight: 800,
                  cursor: resetInputText.trim().toUpperCase() === 'RESET' ? 'pointer' : 'not-allowed',
                }}
              >
                {t('settings.backup.confirmResetYes')}
              </button>

              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetInputText('');
                }}
                style={{
                  height: 40,
                  padding: '0 16px',
                  background: '#202024',
                  border: '1px solid #262628',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
