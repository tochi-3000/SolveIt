/**
 * Client-side Image Optimization and Compression Utility
 * Production Safeguards:
 * - Offscreen canvas downscaling with memory release
 * - Dimension clamping to max 1600x1600 to prevent payload exhaustion
 * - Re-encodes as JPEG with 0.85 quality (<150KB for typical exam sheets)
 * - Defensive handling of input types (File, Blob, base64 data URI)
 */

export interface OptimizeImageOptions {
  maxDimension?: number;
  quality?: number;
}

/**
 * Optimizes an input image (File, Blob, or base64) to a compressed JPEG data URI.
 */
export async function optimizeImage(
  input: File | Blob | string,
  options: OptimizeImageOptions = {}
): Promise<string> {
  const { maxDimension = 1600, quality = 0.85 } = options;

  if (typeof window === 'undefined') {
    throw new Error('Image optimization is only supported in browser environments.');
  }

  // Convert File / Blob to base64 if needed
  let dataUri: string;
  if (typeof input === 'string') {
    dataUri = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
  } else {
    dataUri = await readFileAsDataUri(input);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const { naturalWidth: width, naturalHeight: height } = img;

        if (width === 0 || height === 0) {
          throw new Error('Image has zero dimensions or is corrupt.');
        }

        // Calculate aspect-ratio preserved downscaled dimensions
        let targetWidth = width;
        let targetHeight = height;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            targetWidth = maxDimension;
            targetHeight = Math.round((height / width) * maxDimension);
          } else {
            targetHeight = maxDimension;
            targetWidth = Math.round((width / height) * maxDimension);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to create offscreen 2D canvas context.');
        }

        // Smooth image downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill white background in case source has transparency (PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const compressedUri = canvas.toDataURL('image/jpeg', quality);

        // Clean up canvas
        canvas.width = 0;
        canvas.height = 0;

        resolve(compressedUri);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to decode image data for optimization.'));
    };

    img.src = dataUri;
  });
}

function readFileAsDataUri(fileOrBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unexpected FileReader result type.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(fileOrBlob);
  });
}
