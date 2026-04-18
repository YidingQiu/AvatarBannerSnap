"""
LinkedIn calibration ratio extractor — gradient method.

Usage:
    pip install -r requirements.txt
    python detect_linkedin_calibration.py screenshot_1280.png [screenshot_1440.png ...]

How it works
------------
The test image encodes position in colour:
    R = round(x / 3000 * 255)   — horizontal position in original image
    G = round(y / 2000 * 255)   — vertical position in original image
    B = 80                       — constant marker

After uploading to LinkedIn and screenshotting, any pixel with B≈80 tells us
exactly where in the original image it came from.  No circle detection or
colour fiducials are needed.

Detection steps per screenshot
-------------------------------
1.  Isolate gradient pixels: B in [55, 105].
2.  Find banner rect: the widest horizontal extent of gradient pixels
    near the top of the screenshot (the banner is a full-width crop of the
    top portion of the original image, so it spans nearly the full width).
3.  Find avatar circle: the circular cluster of gradient pixels in the
    lower-left area (below/overlapping the banner bottom).  Fit a minimum
    enclosing circle to those pixels.
4.  Compute ratios from screen-space measurements.
5.  Cross-check using gradient colour: sample the avatar circle centre in
    the screenshot and verify R≈127, G≈127 (≈ original centre 1500, 1000).

Output: cx_ratio, cy_ratio, d_ratio + ready-to-paste TypeScript constants.
"""

import sys
import datetime
import numpy as np
import cv2

ORIG_W, ORIG_H = 3000, 2000
B_MARKER = 80          # constant B value baked into the gradient image
B_LO, B_HI = 55, 105  # tolerance for JPEG compression artefacts


# ---------------------------------------------------------------------------
# Step 1 — isolate gradient pixels
# ---------------------------------------------------------------------------

def gradient_mask(bgr: np.ndarray) -> np.ndarray:
    """
    Return a binary mask where pixels have B≈80 (our gradient marker).
    Gridline pixels (very dark) are excluded so they don't fragment the mask.
    """
    b = bgr[:, :, 0]  # OpenCV stores BGR
    mask = np.where((b >= B_LO) & (b <= B_HI), 255, 0).astype(np.uint8)

    # Close small holes left by gridlines / text labels
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    return mask


# ---------------------------------------------------------------------------
# Step 2 — find banner rectangle
# ---------------------------------------------------------------------------

def find_banner_rect(
    mask: np.ndarray,
) -> tuple[int, int, int, int] | None:
    """
    The banner is the widest rectangular region of gradient pixels.
    LinkedIn renders the banner as a full-width strip at the top of the profile.

    Strategy:
      - Find the topmost row containing gradient pixels → banner top.
      - Scan downward; find the row with the maximum horizontal span → banner width.
      - Banner height = banner_width / 4  (LinkedIn 4:1 fixed ratio).
      - Banner left edge = leftmost gradient pixel in the top rows.
    """
    rows_with_grad = np.where(mask.any(axis=1))[0]
    if len(rows_with_grad) == 0:
        return None

    top_row = int(rows_with_grad[0])

    # Scan first 200 rows below top_row to find full banner width
    scan_end = min(top_row + 200, mask.shape[0])
    max_span = 0
    best_left = 0
    for r in range(top_row, scan_end):
        cols = np.where(mask[r] > 0)[0]
        if len(cols) == 0:
            continue
        span = int(cols[-1]) - int(cols[0])
        if span > max_span:
            max_span = span
            best_left = int(cols[0])

    if max_span < 50:
        print('  [error] banner width too small — gradient not found in top region')
        return None

    bw = max_span
    bh = bw // 4  # LinkedIn banner is 4:1
    bx = best_left
    by = top_row

    return bx, by, bw, bh


# ---------------------------------------------------------------------------
# Step 3 — find avatar circle
# ---------------------------------------------------------------------------

def find_avatar_circle(
    mask: np.ndarray,
    banner: tuple[int, int, int, int],
) -> tuple[int, int, int] | None:
    """
    The avatar is a circular clip of the original image, displayed
    overlapping the lower-left of the banner and extending below it.

    In the gradient mask, the avatar appears as a circular cluster of B≈80
    pixels that is SEPARATE from the main banner rectangle (because LinkedIn
    draws the avatar on top, showing a different crop of the original image).

    Strategy:
      - Search below the upper portion of the banner (y > banner_top + banner_h * 0.5).
      - Find contours and pick the most circular one.
      - Fit a minimum enclosing circle.
    """
    bx, by, bw, bh = banner
    img_h, img_w = mask.shape[:2]

    # Search window: vertically from mid-banner downward, left half horizontally
    sy = by + bh // 2
    ey = min(img_h, by + int(bh * 2.2))
    ex = min(img_w, bx + bw)

    roi = mask[sy:ey, bx:ex].copy()

    # Remove the banner body from the ROI so only the avatar region remains.
    # The banner body fills the full width; below the banner bottom the only
    # gradient pixels are avatar pixels.
    banner_bottom_in_roi = bh - bh // 2  # = bh/2 rows into ROI
    roi[:banner_bottom_in_roi, :] = 0    # blank out remaining banner rows

    contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        print('  [warn] no avatar contour found in search region')
        return None

    # Score by circularity; discard very small blobs
    best = None
    best_score = 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < 200:
            continue
        perim = cv2.arcLength(c, True)
        if perim == 0:
            continue
        circ = 4 * np.pi * area / (perim ** 2)
        if circ > best_score:
            best_score = circ
            best = c

    if best is None:
        return None

    (cx_roi, cy_roi), r = cv2.minEnclosingCircle(best)
    cx = int(round(cx_roi)) + bx
    cy = int(round(cy_roi)) + sy
    return cx, cy, int(round(r))


# ---------------------------------------------------------------------------
# Step 4 — compute ratios
# ---------------------------------------------------------------------------

def compute_ratios(
    banner: tuple[int, int, int, int],
    avatar: tuple[int, int, int],
) -> tuple[float, float, float]:
    bx, by, bw, bh = banner
    cx, cy, r = avatar
    cx_ratio = (cx - bx) / bw
    cy_ratio = (cy - by) / bh   # > 1.0 means avatar centre is below banner bottom
    d_ratio  = (2 * r)  / bw
    return cx_ratio, cy_ratio, d_ratio


# ---------------------------------------------------------------------------
# Step 5 — gradient cross-check
# ---------------------------------------------------------------------------

def gradient_crosscheck(
    bgr: np.ndarray,
    avatar: tuple[int, int, int],
) -> None:
    """
    Sample the pixel at the detected avatar centre.
    Its R/G values should encode original coordinates ≈ (1500, 1000)
    since LinkedIn crops the avatar from the image centre.
    """
    cx, cy, _ = avatar
    h, w = bgr.shape[:2]
    if 0 <= cx < w and 0 <= cy < h:
        b, g, r = bgr[cy, cx]  # BGR
        orig_x = round(r / 255 * ORIG_W)
        orig_y = round(g / 255 * ORIG_H)
        print(f'  gradient check: pixel at avatar centre → R={r} G={g} B={b}')
        print(f'    decoded original coords: ({orig_x}, {orig_y})')
        print(f'    expected ≈ (1500, 1000) — delta: ({orig_x - 1500:+d}, {orig_y - 1000:+d})')
    else:
        print('  [warn] avatar centre out of image bounds — cannot cross-check')


# ---------------------------------------------------------------------------
# Per-screenshot processing
# ---------------------------------------------------------------------------

def process_screenshot(path: str) -> dict | None:
    print(f'\n--- {path} ---')
    bgr = cv2.imread(path)
    if bgr is None:
        print('  [error] cannot read file')
        return None

    h, w = bgr.shape[:2]
    print(f'  screenshot: {w}x{h}')

    mask = gradient_mask(bgr)
    grad_px = int(mask.sum() / 255)
    print(f'  gradient pixels found: {grad_px}')
    if grad_px < 500:
        print('  [error] too few gradient pixels — check screenshot contains the test image')
        return None

    banner = find_banner_rect(mask)
    if banner is None:
        return None
    bx, by, bw, bh = banner
    print(f'  banner: x={bx} y={by} w={bw} h={bh}  aspect={bw/max(bh,1):.2f}')

    avatar = find_avatar_circle(mask, banner)
    if avatar is None:
        print('  [error] avatar circle not found')
        return None
    cx, cy, r = avatar
    print(f'  avatar: cx={cx} cy={cy} r={r}  diameter={2*r}')

    gradient_crosscheck(bgr, avatar)

    cx_ratio, cy_ratio, d_ratio = compute_ratios(banner, avatar)
    print(f'  cx_ratio={cx_ratio:.6f}  cy_ratio={cy_ratio:.6f}  d_ratio={d_ratio:.6f}')

    # Save annotated debug image
    debug = bgr.copy()
    cv2.rectangle(debug, (bx, by), (bx + bw, by + bh), (0, 200, 0), 3)
    cv2.circle(debug, (cx, cy), r, (255, 80, 255), 3)
    cv2.circle(debug, (cx, cy), 5,  (255, 80, 255), -1)
    debug_path = path.rsplit('.', 1)[0] + '_annotated.png'
    cv2.imwrite(debug_path, debug)
    print(f'  annotated: {debug_path}')

    return {'cx_ratio': cx_ratio, 'cy_ratio': cy_ratio, 'd_ratio': d_ratio}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) < 2:
        print('Usage: python detect_linkedin_calibration.py <s1.png> [s2.png ...]')
        sys.exit(1)

    results = [r for p in sys.argv[1:] if (r := process_screenshot(p)) is not None]
    if not results:
        print('\nNo valid measurements.')
        sys.exit(1)

    cx_v = [r['cx_ratio'] for r in results]
    cy_v = [r['cy_ratio'] for r in results]
    d_v  = [r['d_ratio']  for r in results]

    cx_mean, cx_std = float(np.mean(cx_v)), float(np.std(cx_v))
    cy_mean, cy_std = float(np.mean(cy_v)), float(np.std(cy_v))
    d_mean,  d_std  = float(np.mean(d_v)),  float(np.std(d_v))

    print('\n=== Summary ===')
    print(f'  cx_ratio  mean={cx_mean:.6f}  std={cx_std:.6f}')
    print(f'  cy_ratio  mean={cy_mean:.6f}  std={cy_std:.6f}')
    print(f'  d_ratio   mean={d_mean:.6f}   std={d_std:.6f}')

    if len(results) > 1:
        stable = cx_std < 0.01 and cy_std < 0.01 and d_std < 0.01
        status = 'STABLE — fixed proportional layout confirmed.' if stable \
                 else '[warn] ratios vary (std > 0.01) — DOM detection may be needed (Phase 2).'
        print(f'\n  {status}')

    today = datetime.date.today().isoformat()
    print('\n=== Paste into packages/editor/src/platforms/linkedin.ts ===')
    print(f'    cx_ratio:     {cx_mean:.6f},')
    print(f'    cy_ratio:     {cy_mean:.6f},')
    print(f'    d_ratio:      {d_mean:.6f},')
    print(f'    calibratedAt: "{today}",')


if __name__ == '__main__':
    main()
