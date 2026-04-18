import { useRef, useEffect, useCallback } from 'react';
import {
  Canvas as FabricCanvas,
  FabricImage,
  Rect as FabricRect,
  Circle as FabricCircle,
  Shadow,
} from 'fabric';
import type { PlatformConfig } from './platforms/_template';
import type { PhotoTransform } from './types';

export const DISPLAY_W = 880;

interface Props {
  photoSrc: string | null;
  transform: PhotoTransform;
  platform: PlatformConfig;
  onTransformChange: (t: PhotoTransform) => void;
}


function computeDisplayMetrics(platform: PlatformConfig) {
  const { banner, avatar } = platform;
  const bannerH = Math.round(DISPLAY_W / (banner.exportW / banner.exportH));
  const cx = (avatar.cx_ratio ?? 0.08) * DISPLAY_W;
  const cy = (avatar.cy_ratio ?? 1.19) * bannerH;
  const r  = ((avatar.d_ratio ?? 0.10) * DISPLAY_W) / 2;
  const canvasH = Math.ceil(cy + r + 28);
  return { bannerH, cx, cy, r, canvasH };
}

function buildOverlays(
  bannerH: number,
  cx: number,
  cy: number,
  r: number,
  bannerLabel: string,
  avatarLabel: string,
) {
  const shadowOpts = { color: 'rgba(0,0,0,0.6)', blur: 6, offsetX: 1, offsetY: 1 };

  const bannerRect = new FabricRect({
    left: 0,
    top: 0,
    width: DISPLAY_W,
    height: bannerH,
    fill: 'transparent',
    stroke: '#ffffff',
    strokeWidth: 2,
    strokeDashArray: [8, 4],
    selectable: false,
    evented: false,
    shadow: new Shadow(shadowOpts),
  });

  const avatarCircle = new FabricCircle({
    left: cx - r,
    top: cy - r,
    radius: r,
    fill: 'transparent',
    stroke: '#ffffff',
    strokeWidth: 2,
    strokeDashArray: [8, 4],
    selectable: false,
    evented: false,
    shadow: new Shadow(shadowOpts),
  });

  // Small text labels inside each shape
  // Fabric Text isn't imported here to keep the bundle lean;
  // we'll draw them via canvas 2d overlay after fabric renders.
  void bannerLabel; void avatarLabel;

  return { bannerRect, avatarCircle };
}

export function EditorCanvas({ photoSrc, transform, platform, onTransformChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasEl     = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<FabricCanvas | null>(null);
  const photoRef     = useRef<FabricImage | null>(null);
  const metricsRef   = useRef(computeDisplayMetrics(platform));
  const transformRef = useRef(transform);

  // Keep ref in sync so event handlers don't capture stale closures
  transformRef.current = transform;

  const readTransform = useCallback((): PhotoTransform => {
    const img = photoRef.current;
    if (!img) return transformRef.current;
    return {
      translateX: img.left - DISPLAY_W / 2,
      translateY: img.top  - metricsRef.current.bannerH / 2,
      scale:      img.scaleX,
      rotation:   img.angle ?? 0,
      flipX:      img.flipX ?? false,
      flipY:      img.flipY ?? false,
    };
  }, []);

  // ── Init fabric canvas (once) ──────────────────────────────────────────
  useEffect(() => {
    const el = canvasEl.current;
    if (!el) return;

    const m = computeDisplayMetrics(platform);
    metricsRef.current = m;

    const fc = new FabricCanvas(el, {
      width: DISPLAY_W,
      height: m.canvasH,
      selection: false,
      backgroundColor: '#666',
      renderOnAddRemove: false,
    });
    fabricRef.current = fc;

    const { bannerRect, avatarCircle } = buildOverlays(
      m.bannerH, m.cx, m.cy, m.r, 'Banner', 'Profile Photo',
    );
    fc.add(bannerRect);
    fc.add(avatarCircle);
    fc.renderAll();

    // Wheel → zoom photo
    fc.on('mouse:wheel', (opt) => {
      const img = photoRef.current;
      if (!img) return;
      const factor = opt.e.deltaY > 0 ? 0.95 : 1.05;
      const next = Math.max(0.05, Math.min(30, img.scaleX * factor));
      img.set({ scaleX: next, scaleY: next });
      fc.renderAll();
      onTransformChange(readTransform());
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Drag end → sync
    fc.on('object:modified', () => onTransformChange(readTransform()));
    fc.on('object:moving',   () => onTransformChange(readTransform()));

    return () => { fc.dispose(); fabricRef.current = null; photoRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);  // re-init only if platform changes

  // ── Load photo ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc || !photoSrc) return;
    let cancelled = false;

    FabricImage.fromURL(photoSrc, { crossOrigin: 'anonymous' }).then((img) => {
      if (cancelled || !fabricRef.current) return;
      const { bannerH } = metricsRef.current;

      // Remove previous photo
      if (photoRef.current) fc.remove(photoRef.current);

      // Initial scale: fill banner area
      const initScale = Math.max(
        DISPLAY_W / img.width!,
        bannerH  / img.height!,
      );

      img.set({
        left:     DISPLAY_W / 2,
        top:      bannerH / 2,
        originX:  'center',
        originY:  'center',
        scaleX:   initScale,
        scaleY:   initScale,
        hasControls: false,
        hasBorders:  false,
        lockUniScaling: true,
      });

      fc.add(img);
      fc.sendObjectToBack(img);
      photoRef.current = img;
      fc.renderAll();

      onTransformChange({
        translateX: 0,
        translateY: 0,
        scale:      initScale,
        rotation:   0,
        flipX:      false,
        flipY:      false,
      });
    });

    return () => { cancelled = true; };
  }, [photoSrc, onTransformChange]);

  // ── Sync React transform → fabric ────────────────────────────────────
  useEffect(() => {
    const fc  = fabricRef.current;
    const img = photoRef.current;
    if (!fc || !img) return;
    const { bannerH } = metricsRef.current;
    img.set({
      left:     DISPLAY_W / 2 + transform.translateX,
      top:      bannerH / 2   + transform.translateY,
      scaleX:   transform.scale,
      scaleY:   transform.scale,
      angle:    transform.rotation,
      flipX:    transform.flipX,
      flipY:    transform.flipY,
    });
    fc.renderAll();
  }, [transform]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasEl} />
    </div>
  );
}
