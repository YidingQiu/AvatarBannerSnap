# Calibrate a Social Platform for AvatarBannerSnap

Calibrate the banner dimensions and avatar overlay position for a social media platform ($ARGUMENTS), then create or update its `PlatformConfig` file in `packages/editor/src/platforms/`.

---

## What you are solving

Social platforms display the banner and profile photo together on the profile page. To make them appear as one seamless image we need three ratios — all relative to the rendered banner:

| Constant | Meaning |
|---|---|
| `cx_ratio` | Avatar center X / banner width |
| `cy_ratio` | Avatar center Y / banner height (can be > 1 if avatar overlaps below) |
| `d_ratio` | Avatar image diameter / banner width |

Plus the official export dimensions: `exportW`, `exportH` (banner), `exportSize` (avatar square).

---

## Step 1 — Find the official export dimensions

Search the platform's help center or creator docs for the recommended image sizes. Look for:
- Banner / cover photo: width x height in pixels
- Profile photo: recommended square size

Record these as `exportW`, `exportH`, `exportSize`.

Examples for reference:
- LinkedIn: 1584 x 396 banner, 400 avatar
- Twitter/X: 1500 x 500 banner, 400 avatar
- GitHub: 1280 x 384 banner (org page), 460 avatar

---

## Step 2 — Upload a test image and open the profile page

Ask the user to:
1. Upload any solid-color or gradient image as both the banner and profile photo on the target platform.
2. Navigate to their profile page in a desktop browser (not mobile).
3. Open DevTools console (F12).

---

## Step 3 — Run the DOM measurement script in the browser console

Provide the user with this script to paste into the console. They should replace the two selectors with the correct ones for the target platform (see Step 3a below).

```javascript
(function () {
  // --- CONFIGURE THESE TWO SELECTORS FOR THE TARGET PLATFORM ---
  const bannerEl = document.querySelector('BANNER_SELECTOR');
  const avatarEl = document.querySelector('AVATAR_SELECTOR');
  // -------------------------------------------------------------

  if (!bannerEl) { console.error('Banner element not found — check BANNER_SELECTOR'); return; }
  if (!avatarEl) { console.error('Avatar element not found — check AVATAR_SELECTOR'); return; }

  const bannerRect = bannerEl.getBoundingClientRect();
  // Use img inside avatar container to exclude border rings
  const avatarImg = avatarEl.querySelector('img') ?? avatarEl;
  const avatarRect = avatarImg.getBoundingClientRect();

  const bx = bannerRect.left,  by = bannerRect.top;
  const bw = bannerRect.width, bh = bannerRect.height;
  const avatarCx = avatarRect.left + avatarRect.width  / 2;
  const avatarCy = avatarRect.top  + avatarRect.height / 2;
  const avatarD  = Math.max(avatarRect.width, avatarRect.height);

  const cx_ratio = (avatarCx - bx) / bw;
  const cy_ratio = (avatarCy - by) / bh;
  const d_ratio  = avatarD / bw;

  console.log('=== Calibration ===');
  console.log(`Banner : x=${bx.toFixed(1)} y=${by.toFixed(1)} w=${bw.toFixed(1)} h=${bh.toFixed(1)}`);
  console.log(`Avatar : cx=${avatarCx.toFixed(1)} cy=${avatarCy.toFixed(1)} d=${avatarD.toFixed(1)}`);
  console.log(`cx_ratio = ${cx_ratio.toFixed(6)}`);
  console.log(`cy_ratio = ${cy_ratio.toFixed(6)}`);
  console.log(`d_ratio  = ${d_ratio.toFixed(6)}`);
  console.log('');
  console.log('--- paste into platform ts file ---');
  console.log(`    cx_ratio:     ${cx_ratio.toFixed(6)},`);
  console.log(`    cy_ratio:     ${cy_ratio.toFixed(6)},`);
  console.log(`    d_ratio:      ${d_ratio.toFixed(6)},`);
  console.log(`    calibratedAt: "${new Date().toISOString().slice(0,10)}",`);
})();
```

### Step 3a — Find the correct selectors

Use DevTools Elements panel (hover over the banner image and avatar image to inspect them).

**Finding the banner selector:**
- Right-click the banner image → Inspect
- Look for an `<img>` tag with an alt attribute like "Cover photo", "Background", "Header image"
- Try: `img[alt="Cover photo"]` or `img[alt="Background photo"]`
- Verify: `document.querySelector('YOUR_SELECTOR').getBoundingClientRect()` should show a wide rect

**Finding the avatar selector:**
- Right-click the profile photo → Inspect
- Look for a container `<div>` or `<figure>` with aria-label like "Profile photo", "Avatar"
- Try: `[aria-label="Profile photo"] figure` or `[aria-label="Avatar"] img`
- The script queries `img` inside the container automatically to exclude border rings
- Verify: the returned rect should be roughly square and positioned near the banner's lower-left

**Sanity checks on the output:**
- `bw` should equal the visible banner width on screen (e.g. 792px at 1440px viewport)
- `cx_ratio` is typically 0.05–0.20 (avatar is near the left edge)
- `cy_ratio` can be slightly below 1.0 (avatar overlaps bottom of banner) or slightly above 1.0
- `d_ratio` is typically 0.12–0.25

If `cy_ratio` is negative or near 0, the wrong element was selected (probably a nav icon).

---

## Step 4 — Repeat at multiple viewport widths

Ask the user to resize the browser window to at least two widths (e.g. 1280px and 1440px) and re-run the script each time. Record all three values at each width.

**If ratios are stable** (difference < 0.01 across viewports): the constants are viewport-independent — proceed.

**If ratios vary significantly**: the platform uses responsive layout for the avatar. Note the breakpoint, pick the most common desktop width (usually 1440px), and add a note in the `notes` field.

---

## Step 5 — Create the platform config file

Create `packages/editor/src/platforms/<platform-id>.ts`:

```typescript
import type { PlatformConfig } from './_template';

export const PLATFORM_NAME: PlatformConfig = {
  id: '<platform-id>',
  name: '<Display Name>',
  banner: {
    exportW: <official banner width>,
    exportH: <official banner height>,
  },
  avatar: {
    exportSize: <official avatar size>,
    // pc_lg_xl — calibrated <date> via getBoundingClientRect on img element
    cx_ratio:     <value>,
    cy_ratio:     <value>,
    d_ratio:      <value>,
    // mobile — TODO Phase 2
    // cx_ratio_mobile: null,
    // cy_ratio_mobile: null,
    // d_ratio_mobile:  null,
  },
  calibratedAt: '<YYYY-MM-DD>',
  notes: '<viewport class> only. Calibrated via DOM getBoundingClientRect at <banner_width>px rendered banner width.',
};
```

Then register it in `packages/editor/src/platforms/index.ts`.

---

## Step 6 — Visual verification

Ask the user to:
1. Run `pnpm dev` and open the editor at `http://localhost:5173`
2. Upload any photo with a visible grid or pattern
3. Check that the dashed overlay circle lines up visually with where the avatar appears on the platform's profile page

If the circle is offset or wrong size, re-run the DOM script and compare values.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `cy_ratio` is negative or near 0 | Wrong avatar element selected — matched a nav icon | Use DevTools to find correct selector |
| `d_ratio` seems too large | Border ring included in measurement | Script already queries `img` inside container — check if platform wraps avatar differently |
| Ratios vary across viewports | Responsive layout shifts avatar position | Calibrate at target viewport, note breakpoint |
| Banner element not found | Platform uses lazy-loaded images or dynamic class names | Scroll to fully load banner, or use a more general selector like `.profile-cover img` |
| Console output looks correct but overlay is visually off | Export dimensions wrong | Double-check official banner size from platform help docs |
