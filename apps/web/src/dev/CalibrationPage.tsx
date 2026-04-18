import { useRef, useCallback } from 'react';

const W = 3000;
const H = 2000;

// Gradient encoding:
//   R = round(x / W * 255)  — encodes horizontal position (0=left, 255=right)
//   G = round(y / H * 255)  — encodes vertical position   (0=top,  255=bottom)
//   B = 80                  — constant marker to isolate our pixels from LinkedIn UI
//
// After uploading to LinkedIn and screenshotting:
//   sample any pixel with B≈80 → its (R, G) directly gives the original (x, y) coordinates.
//   detect_linkedin_calibration.py isolates B≈80 pixels to find banner rect and avatar circle.

function drawCalibrationImage(canvas: HTMLCanvasElement) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Layer 1: 2D position-encoding gradient via ImageData (fast)
  const img = ctx.createImageData(W, H);
  const buf = img.data;
  for (let y = 0; y < H; y++) {
    const g = Math.round((y / H) * 255);
    for (let x = 0; x < W; x++) {
      const r = Math.round((x / W) * 255);
      const i = (y * W + x) * 4;
      buf[i]     = r;
      buf[i + 1] = g;
      buf[i + 2] = 80;  // constant B marker
      buf[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Layer 2: thin gridlines every 100px — visual ruler only, ignored by detector
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 100) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Layer 3: coordinate labels along top and left edges only
  // (not placed inside the gradient body, to minimise B≈80 pixel contamination)
  ctx.font = '18px monospace';
  for (let x = 100; x < W; x += 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(String(x), x + 2, 16);
  }
  for (let y = 100; y < H; y += 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(String(y), 2, y - 3);
  }

  // Layer 4: center crosshair — human visual reference for avatar crop center
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W / 2 - 40, H / 2); ctx.lineTo(W / 2 + 40, H / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - 40); ctx.lineTo(W / 2, H / 2 + 40); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#000000';
  ctx.beginPath(); ctx.moveTo(W / 2 - 40, H / 2); ctx.lineTo(W / 2 + 40, H / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - 40); ctx.lineTo(W / 2, H / 2 + 40); ctx.stroke();

  // Legend — white box in bottom-right, outside main gradient area
  const lx = W - 580, ly = H - 130;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(lx - 10, ly - 26, 582, 130);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#000';
  ctx.fillText('Gradient encoding  (pixel color = original position)', lx, ly);
  ctx.font = '17px monospace';
  ctx.fillText('R channel: round(x / 3000 * 255)', lx, ly + 26);
  ctx.fillText('G channel: round(y / 2000 * 255)', lx, ly + 50);
  ctx.fillText('B channel: 80  (constant — marks our pixels)', lx, ly + 74);
  ctx.fillText('Center (1500, 1000) → R=127, G=127, B=80', lx, ly + 98);
}

export default function CalibrationPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleGenerate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCalibrationImage(canvas);
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'linkedin_calibration_3000x2000.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1100 }}>
      <h2 style={{ marginBottom: 8 }}>Calibration Image Generator</h2>
      <p style={{ marginBottom: 4, color: '#444', fontSize: 14, lineHeight: 1.6 }}>
        Generates a 3000x2000 gradient image where each pixel&apos;s <b>R</b> channel encodes its
        original <b>x</b> position and <b>G</b> channel encodes its <b>y</b> position.
        After uploading to LinkedIn and screenshotting, sampling any pixel with <b>B≈80</b>
        directly tells you where it came from in the original image.
      </p>
      <p style={{ marginBottom: 16, color: '#666', fontSize: 13 }}>
        Workflow: Generate → Download PNG → upload to LinkedIn as <i>both</i> banner and profile
        photo (do NOT drag/reposition when prompted) → screenshot at 1280/1440/1920px → run
        <code style={{ background: '#eee', padding: '1px 5px', borderRadius: 3, margin: '0 4px' }}>
          python tools/detect_linkedin_calibration.py screenshot.png
        </code>
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button onClick={handleGenerate} style={btnStyle('#1a73e8')}>
          Generate ({W}x{H})
        </button>
        <button onClick={handleDownload} style={btnStyle('#188038')}>
          Download PNG
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #ccc', borderRadius: 4 }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
        />
      </div>

      <table style={{ borderCollapse: 'collapse', marginTop: 20, fontSize: 13 }}>
        <thead>
          <tr>
            {['Pixel position (original)', 'R value', 'G value', 'B value', 'Meaning'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ['(0, 0)',    '0',   '0',   '80', 'Top-left corner'],
            ['(3000, 0)', '255', '0',   '80', 'Top-right corner'],
            ['(0, 2000)', '0',   '255', '80', 'Bottom-left corner'],
            ['(1500, 1000)', '127', '127', '80', 'Image center — avatar crop center'],
          ].map(([pos, r, g, b, meaning]) => (
            <tr key={pos}>
              <td style={tdStyle}><code>{pos}</code></td>
              <td style={tdStyle}>{r}</td>
              <td style={tdStyle}>{g}</td>
              <td style={tdStyle}>{b}</td>
              <td style={tdStyle}>{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none',
           padding: '8px 18px', borderRadius: 4, fontSize: 14, fontWeight: 600 };
}
const thStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '4px 10px', background: '#f0f0f0', textAlign: 'left',
};
const tdStyle: React.CSSProperties = {
  border: '1px solid #ccc', padding: '4px 10px',
};
