import type { PhotoTransform } from './types';
import type en from './i18n/en.json';

type I18n = typeof en;

interface Props {
  transform: PhotoTransform;
  onChange: (t: PhotoTransform) => void;
  onExport: () => void;
  exporting: boolean;
  t: I18n;
}

export function ControlBar({ transform, onChange, onExport, exporting, t }: Props) {
  const set = (patch: Partial<PhotoTransform>) => onChange({ ...transform, ...patch });

  return (
    <div style={styles.bar}>
      <label style={styles.sliderRow}>
        <span style={styles.label}>{t.rotation}</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={0.5}
          value={transform.rotation}
          onChange={(e) => set({ rotation: Number(e.target.value) })}
          style={styles.slider}
        />
        <span style={styles.value}>{transform.rotation.toFixed(1)}°</span>
      </label>

      <div style={styles.row}>
        <button
          style={btnStyle(transform.flipX)}
          onClick={() => set({ flipX: !transform.flipX })}
        >
          {t.flip_h}
        </button>
        <button
          style={btnStyle(transform.flipY)}
          onClick={() => set({ flipY: !transform.flipY })}
        >
          {t.flip_v}
        </button>
        <button style={btnStyle(false)} onClick={() => onChange(defaultTransform())}>
          {t.reset}
        </button>
      </div>

      <button
        style={styles.exportBtn}
        onClick={onExport}
        disabled={exporting}
      >
        {exporting ? '...' : t.download_btn}
      </button>
      <p style={styles.tip}>{t.download_tip}</p>
    </div>
  );
}

function defaultTransform(): PhotoTransform {
  return { translateX: 0, translateY: 0, scale: 1, rotation: 0, flipX: false, flipY: false };
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: 4,
    border: '1px solid #ccc',
    background: active ? '#1a73e8' : '#fff',
    color: active ? '#fff' : '#333',
    cursor: 'pointer',
    fontSize: 13,
  };
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '12px 0',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  label: { fontSize: 13, color: '#555', minWidth: 56 },
  slider: { flex: 1 },
  value: { fontSize: 13, minWidth: 52, textAlign: 'right' },
  row: { display: 'flex', gap: 8 },
  exportBtn: {
    marginTop: 4,
    padding: '10px 0',
    background: '#188038',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tip: { fontSize: 12, color: '#888', margin: 0 },
};
