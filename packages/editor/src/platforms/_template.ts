export interface PlatformConfig {
  id: string;
  name: string;
  banner: {
    exportW: number;
    exportH: number;
  };
  avatar: {
    exportSize: number;
    cx_ratio: number | null;
    cy_ratio: number | null;
    d_ratio: number | null;
  };
  calibratedAt: string | null;
  notes: string;
}
