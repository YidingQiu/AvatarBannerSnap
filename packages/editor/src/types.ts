export interface PhotoTransform {
  translateX: number;  // offset from banner centre, in display pixels
  translateY: number;
  scale: number;       // fabric scaleX/scaleY (photo natural px * scale = display px)
  rotation: number;    // degrees
  flipX: boolean;
  flipY: boolean;
}

export const DEFAULT_TRANSFORM: PhotoTransform = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
};
