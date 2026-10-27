/**
 * Client-side image cropping and normalization utilities for SolvAm.
 * Crops a normalized bounding box [yMin, xMin, yMax, xMax] (0.0 to 1.0)
 * from a base64 or data URI image using an offscreen HTML5 canvas with safety padding.
 *
 * Production Safeguards:
 * - Omits crossOrigin on data: URIs to prevent canvas tainting in strict WebKit/Chromium
 * - Fills white background to prevent black background artifacts on transparent PNGs/SVGs
 * - Clamps coordinates strictly within [0.0 - 1.0]
 * - Garbage collection cleanup on temporary canvas elements
 */

import { BoundingBox } from '@solvam/shared-types';

export function cropImageRegion(
  base64Image: string,
  box: BoundingBox,
  paddingPercent: number = 0.05
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Canvas cropping is only supported in browser environments.'));
    }

    const img = new Image();
    const isDataUri = base64Image.startsWith('data:');

    if (!isDataUri) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;

        if (imgWidth <= 0 || imgHeight <= 0) {
          throw new Error('Image dimensions could not be determined.');
        }

        // Calculate padded coordinates with boundary clamps
        const padY = (box.yMax - box.yMin) * paddingPercent;
        const padX = (box.xMax - box.xMin) * paddingPercent;

        const clampedYMin = Math.max(0, box.yMin - padY);
        const clampedXMin = Math.max(0, box.xMin - padX);
        const clampedYMax = Math.min(1, box.yMax + padY);
        const clampedXMax = Math.min(1, box.xMax + padX);

        const sourceX = Math.round(clampedXMin * imgWidth);
        const sourceY = Math.round(clampedYMin * imgHeight);
        const sourceWidth = Math.round((clampedXMax - clampedXMin) * imgWidth);
        const sourceHeight = Math.round((clampedYMax - clampedYMin) * imgHeight);

        // Sanity guards
        if (sourceWidth <= 0 || sourceHeight <= 0) {
          throw new Error('Invalid bounding box dimensions for crop.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to create offscreen 2D canvas context.');
        }

        // Fill solid white background so transparent SVG/PNG don't turn black in JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, sourceWidth, sourceHeight);

        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          sourceWidth,
          sourceHeight
        );

        // Export as JPEG with 0.88 quality
        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.88);

        // Cleanup
        canvas.width = 0;
        canvas.height = 0;

        resolve(croppedBase64);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for cropping.'));
    img.src = isDataUri ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  });
}
