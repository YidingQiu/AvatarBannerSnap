import type { PlatformConfig } from './platforms/_template';
import type { PhotoTransform } from './types';

// display-to-export scale: both translateX/Y and fabric scale must be multiplied by this
function exportFactor(platform: PlatformConfig, displayW: number): number {
  return platform.banner.exportW / displayW;
}

function applyTransform(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: PhotoTransform,
  canvasW: number,
  canvasH: number,
  factor: number,
): void {
  const cx = canvasW / 2 + t.translateX * factor;
  const cy = (canvasH / 2) + t.translateY * factor;
  const scale = t.scale * factor;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.flipX ? -scale : scale, t.flipY ? -scale : scale);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();
}

function cropToBlob(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  targetW: number,
  targetH: number,
): Promise<Blob> {
  const dst = document.createElement('canvas');
  dst.width = targetW;
  dst.height = targetH;
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(src, x, y, w, h, 0, 0, targetW, targetH);
  return new Promise((resolve, reject) => {
    dst.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.95,
    );
  });
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportImages(
  photoSrc: string,
  transform: PhotoTransform,
  platform: PlatformConfig,
  displayW: number,
): Promise<void> {
  const { banner, avatar } = platform;

  if (avatar.cx_ratio === null || avatar.cy_ratio === null || avatar.d_ratio === null) {
    throw new Error('Avatar position not calibrated. Run calibration first.');
  }

  // Load image element (may already be cached by browser)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = photoSrc;
  });

  // Offscreen canvas — tall enough to contain the avatar crop region
  const avatarCy = avatar.cy_ratio * banner.exportH;
  const avatarR  = (avatar.d_ratio * banner.exportW) / 2;
  const canvasH  = Math.ceil(Math.max(banner.exportH, avatarCy + avatarR)) + 4;

  const offscreen = document.createElement('canvas');
  offscreen.width  = banner.exportW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext('2d')!;

  const factor = exportFactor(platform, displayW);

  // cy reference point: vertically centred on banner midpoint (same as display)
  applyTransform(ctx, img, transform, banner.exportW, banner.exportH, factor);

  // Crop 1 — banner
  const bannerBlob = await cropToBlob(
    offscreen, 0, 0, banner.exportW, banner.exportH,
    banner.exportW, banner.exportH,
  );

  // Crop 2 — avatar square that LinkedIn then circles
  const avatarCx = avatar.cx_ratio * banner.exportW;
  const cropX = Math.round(avatarCx - avatarR);
  const cropY = Math.round(avatarCy - avatarR);
  const cropSize = Math.round(avatarR * 2);
  const avatarBlob = await cropToBlob(
    offscreen, cropX, cropY, cropSize, cropSize,
    avatar.exportSize, avatar.exportSize,
  );

  download(bannerBlob, 'linkedinsnap_banner.jpg');
  // Small delay so browsers don't block the second download
  await new Promise((r) => setTimeout(r, 150));
  download(avatarBlob, 'linkedinsnap_avatar.jpg');
}
