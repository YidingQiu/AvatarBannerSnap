import { useRef, useEffect, useCallback } from 'react';
import type { PlatformConfig } from './platforms/_template';
import type { PhotoTransform } from './types';
import type en from './i18n/en.json';

type I18n = typeof en;

interface Props {
  photoSrc: string | null;
  transform: PhotoTransform;
  platform: PlatformConfig;
  displayW: number;
  t: I18n;
}

const BANNER_PREVIEW_W = 280;
const AVATAR_PREVIEW_D = 80;

export function PreviewPanel({ photoSrc, transform, platform, displayW, t }: Props) {
  const bannerRef = useRef<HTMLCanvasElement>(null);
  const avatarRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);

  const render = useCallback(() => {
    const bannerCanvas = bannerRef.current;
    const avatarCanvas = avatarRef.current;
    if (!bannerCanvas || !avatarCanvas || !photoSrc) return;

    const img = new Image();
    img.onload = () => {
      const { banner, avatar } = platform;
      const factor = banner.exportW / displayW;

      // --- banner preview ---
      const bScale = BANNER_PREVIEW_W / banner.exportW;
      bannerCanvas.width  = BANNER_PREVIEW_W;
      bannerCanvas.height = Math.round(banner.exportH * bScale);
      const bCtx = bannerCanvas.getContext('2d')!;
      bCtx.fillStyle = '#ccc';
      bCtx.fillRect(0, 0, bannerCanvas.width, bannerCanvas.height);
      bCtx.save();
      bCtx.scale(bScale, bScale);
      drawPhoto(bCtx, img, transform, banner.exportW, banner.exportH, factor);
      bCtx.restore();

      // --- avatar preview ---
      avatarCanvas.width  = AVATAR_PREVIEW_D;
      avatarCanvas.height = AVATAR_PREVIEW_D;
      const aCtx = avatarCanvas.getContext('2d')!;

      if (avatar.cx_ratio !== null && avatar.cy_ratio !== null && avatar.d_ratio !== null) {
        const avatarCx = avatar.cx_ratio * banner.exportW;
        const avatarCy = avatar.cy_ratio * banner.exportH;
        const avatarR  = (avatar.d_ratio * banner.exportW) / 2;
        const cropSize = avatarR * 2;
        const aScale   = AVATAR_PREVIEW_D / cropSize;

        // Render full export into an offscreen canvas first
        const exportH = Math.ceil(Math.max(banner.exportH, avatarCy + avatarR)) + 4;
        const off = document.createElement('canvas');
        off.width  = banner.exportW;
        off.height = exportH;
        const offCtx = off.getContext('2d')!;
        drawPhoto(offCtx, img, transform, banner.exportW, banner.exportH, factor);

        aCtx.save();
        aCtx.beginPath();
        aCtx.arc(AVATAR_PREVIEW_D / 2, AVATAR_PREVIEW_D / 2, AVATAR_PREVIEW_D / 2, 0, Math.PI * 2);
        aCtx.clip();
        aCtx.fillStyle = '#ccc';
        aCtx.fillRect(0, 0, AVATAR_PREVIEW_D, AVATAR_PREVIEW_D);
        aCtx.drawImage(
          off,
          avatarCx - avatarR, avatarCy - avatarR, cropSize, cropSize,
          0, 0, AVATAR_PREVIEW_D, AVATAR_PREVIEW_D,
        );
        aCtx.restore();
        void aScale;
      } else {
        aCtx.fillStyle = '#ddd';
        aCtx.fillRect(0, 0, AVATAR_PREVIEW_D, AVATAR_PREVIEW_D);
        aCtx.font = '10px sans-serif';
        aCtx.fillStyle = '#999';
        aCtx.textAlign = 'center';
        aCtx.fillText('?', AVATAR_PREVIEW_D / 2, AVATAR_PREVIEW_D / 2 + 4);
      }
    };
    img.src = photoSrc;
  }, [photoSrc, transform, platform, displayW]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  return (
    <div style={{ minWidth: BANNER_PREVIEW_W + 20 }}>
      <p style={styles.title}>{t.preview_title}</p>
      <p style={styles.sub}>{t.banner_label}</p>
      <canvas ref={bannerRef} style={styles.bannerCanvas} />
      <p style={{ ...styles.sub, marginTop: 10 }}>{t.avatar_label}</p>
      <canvas
        ref={avatarRef}
        style={{ borderRadius: '50%', display: 'block', width: AVATAR_PREVIEW_D, height: AVATAR_PREVIEW_D }}
      />
    </div>
  );
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: PhotoTransform,
  canvasW: number,
  canvasH: number,
  factor: number,
): void {
  const cx = canvasW / 2 + t.translateX * factor;
  const cy = canvasH / 2 + t.translateY * factor;
  const sc = t.scale * factor;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.flipX ? -sc : sc, t.flipY ? -sc : sc);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontWeight: 600, fontSize: 14, marginBottom: 8 },
  sub:   { fontSize: 12, color: '#666', marginBottom: 4 },
  bannerCanvas: { display: 'block', width: BANNER_PREVIEW_W, border: '1px solid #ccc' },
};
