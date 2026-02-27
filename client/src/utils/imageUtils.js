/**
 * Compress an image file to a small JPEG data URL using Canvas API.
 * If `cropArea` is provided, uses those pixel coordinates; otherwise center-crops to square.
 * Resizes to `size`x`size`, returns base64 data URL.
 */
export function compressAvatar(file, size = 128, quality = 0.6, cropArea) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let sx, sy, sWidth, sHeight;

      if (cropArea) {
        sx = cropArea.x;
        sy = cropArea.y;
        sWidth = cropArea.width;
        sHeight = cropArea.height;
      } else {
        const min = Math.min(img.width, img.height);
        sx = (img.width - min) / 2;
        sy = (img.height - min) / 2;
        sWidth = min;
        sHeight = min;
      }

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/** Extract initials from a name: "John Doe" → "JD" */
export function getInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Deterministic hex color from a string (for avatar background). */
export function getAvatarColor(name) {
  let hash = 0;
  const str = name || '?';
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
    '#3b82f6', '#2563eb',
  ];
  return colors[Math.abs(hash) % colors.length];
}
