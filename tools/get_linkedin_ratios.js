// Run this in the browser console on your LinkedIn profile page.
// Prints calibration constants ready to paste into linkedin.ts.

(function () {
  // --- banner ---
  const bannerImg = document.querySelector('img[alt="Cover photo"]');
  if (!bannerImg) { console.error('Banner image not found'); return; }
  const bannerRect = bannerImg.getBoundingClientRect();

  // --- avatar ---
  // The avatar figure sits inside a div with aria-label="Profile photo"
  const avatarFigure = document.querySelector('[aria-label="Profile photo"] figure');
  if (!avatarFigure) { console.error('Avatar figure not found'); return; }
  // Use the img inside the figure to exclude LinkedIn's white border ring
  const avatarImg = avatarFigure.querySelector('img');
  const avatarRect = (avatarImg || avatarFigure).getBoundingClientRect();

  const bx = bannerRect.left;
  const by = bannerRect.top;
  const bw = bannerRect.width;
  const bh = bannerRect.height;

  const avatarCx = avatarRect.left + avatarRect.width  / 2;
  const avatarCy = avatarRect.top  + avatarRect.height / 2;
  const avatarD  = Math.max(avatarRect.width, avatarRect.height);

  const cx_ratio = (avatarCx - bx) / bw;
  const cy_ratio = (avatarCy - by) / bh;   // expect > 1.0
  const d_ratio  = avatarD / bw;

  console.log('=== LinkedIn calibration ===');
  console.log(`Banner : x=${bx.toFixed(1)} y=${by.toFixed(1)} w=${bw.toFixed(1)} h=${bh.toFixed(1)}`);
  console.log(`Avatar : cx=${avatarCx.toFixed(1)} cy=${avatarCy.toFixed(1)} d=${avatarD.toFixed(1)}`);
  console.log(`cx_ratio = ${cx_ratio.toFixed(6)}`);
  console.log(`cy_ratio = ${cy_ratio.toFixed(6)}`);
  console.log(`d_ratio  = ${d_ratio.toFixed(6)}`);
  console.log('');
  console.log('--- paste into linkedin.ts ---');
  console.log(`    cx_ratio:     ${cx_ratio.toFixed(6)},`);
  console.log(`    cy_ratio:     ${cy_ratio.toFixed(6)},`);
  console.log(`    d_ratio:      ${d_ratio.toFixed(6)},`);
  console.log(`    calibratedAt: "${new Date().toISOString().slice(0,10)}",`);
})();
