import QRCode from 'qrcode';
import { cn } from './cn';

/**
 * QR code drawn as SVG rects from the qrcode matrix (no raw HTML injection).
 * Ink modules on a Petal plate, so phones scan it reliably even off a projector.
 */
export function QrCode({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const quiet = 2;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (qr.modules.get(x, y)) cells.push({ x, y });
  }
  const total = size + quiet * 2;
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      className={cn('bg-petal rounded-[6%]', className)}
      shapeRendering="crispEdges"
    >
      <path
        fill="var(--cc-ink)"
        d={cells.map((c) => `M${c.x + quiet} ${c.y + quiet}h1v1h-1z`).join('')}
      />
    </svg>
  );
}
