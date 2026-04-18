import { useState, useCallback, useRef } from 'react';
import { EditorCanvas, DISPLAY_W } from './EditorCanvas';
import { PreviewPanel } from './PreviewPanel';
import { ControlBar } from './ControlBar';
import { exportImages } from './ExportEngine';
import type { PlatformConfig } from './platforms/_template';
import type { PhotoTransform } from './types';
import enStrings from './i18n/en.json';
import zhStrings from './i18n/zh.json';

type Lang = 'en' | 'zh';

interface Props {
  platform: PlatformConfig;
}

export function Editor({ platform }: Props) {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem('lang') as Lang) ?? 'en'; }
    catch { return 'en'; }
  });
  const t = lang === 'zh' ? zhStrings : enStrings;

  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [transform, setTransform] = useState<PhotoTransform>({
    translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: false, flipY: false,
  });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const switchLang = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem('lang', l); } catch { /* ignore */ }
  };

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setPhotoSrc((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  }, [handleFile]);

  const handleExport = useCallback(async () => {
    if (!photoSrc) return;
    setExporting(true);
    setError(null);
    try {
      await exportImages(photoSrc, transform, platform, DISPLAY_W);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [photoSrc, transform, platform]);

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>AvatarBannerSnap — {platform.name}</span>
        <div style={styles.langToggle}>
          {(['en', 'zh'] as Lang[]).map((l) => (
            <button
              key={l}
              style={{ ...styles.langBtn, fontWeight: lang === l ? 700 : 400 }}
              onClick={() => switchLang(l)}
            >
              {l === 'en' ? 'EN' : '中文'}
            </button>
          ))}
        </div>
      </div>

      {/* Uncalibrated warning */}
      {platform.avatar.cx_ratio === null && (
        <div style={styles.warn}>{t.uncalibrated}</div>
      )}

      {/* Upload zone (shown before photo loaded) */}
      {!photoSrc && (
        <div
          style={styles.dropzone}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          {t.upload_hint}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* Editor area */}
      {photoSrc && (
        <div style={styles.editorArea}>
          <div style={styles.canvasCol}>
            {/* Re-upload button */}
            <div style={{ marginBottom: 8 }}>
              <label style={styles.reuploadBtn}>
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </label>
            </div>

            <EditorCanvas
              photoSrc={photoSrc}
              transform={transform}
              platform={platform}
              onTransformChange={setTransform}
            />

            <ControlBar
              transform={transform}
              onChange={setTransform}
              onExport={handleExport}
              exporting={exporting}
              t={t}
            />

            {error && <p style={styles.error}>{error}</p>}
          </div>

          <PreviewPanel
            photoSrc={photoSrc}
            transform={transform}
            platform={platform}
            displayW={DISPLAY_W}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title:  { fontSize: 18, fontWeight: 700 },
  langToggle: { display: 'flex', gap: 6 },
  langBtn: { background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 13 },
  warn: { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4, padding: '8px 12px', fontSize: 13, marginBottom: 12 },
  dropzone: {
    border: '2px dashed #aaa', borderRadius: 8, padding: '60px 40px',
    textAlign: 'center', cursor: 'pointer', color: '#666', fontSize: 15,
  },
  editorArea: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  canvasCol: { flex: 1, minWidth: 0 },
  reuploadBtn: {
    display: 'inline-block', padding: '5px 12px', background: '#f0f0f0',
    border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 13,
  },
  error: { color: '#c00', fontSize: 13, marginTop: 8 },
};
