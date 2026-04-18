import type { PlatformConfig } from './_template';

// Calibration values are viewport-class specific.
// pc_lg_xl: measured at 792px rendered banner width (LG/XL desktop breakpoint)
// mobile:   pending Phase 2 calibration
export const LINKEDIN: PlatformConfig = {
  id: 'linkedin',
  name: 'LinkedIn',
  banner: {
    exportW: 1584,
    exportH: 396,
  },
  avatar: {
    exportSize: 400,
    // pc_lg_xl — calibrated 2026-04-18 via getBoundingClientRect, img element (excludes border ring)
    cx_ratio:     0.131313,
    cy_ratio:     0.919192,
    d_ratio:      0.191919,
    // mobile — TODO Phase 2
    // cx_ratio_mobile: null,
    // cy_ratio_mobile: null,
    // d_ratio_mobile:  null,
  },
  calibratedAt: '2026-04-18',
  notes: 'PC LG/XL only (792px banner). Calibrated via DOM getBoundingClientRect on img element. Mobile deferred to Phase 2.',
};
