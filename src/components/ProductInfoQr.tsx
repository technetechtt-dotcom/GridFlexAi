import React from 'react';
import { PRODUCT_INFO_PATH, productInfoUrl } from '../lib/demoJourney';

type Props = {
  size?: number;
  className?: string;
};

/**
 * QR linking to the sanitized product-info page.
 * Uses a public QR image API when online; always shows the URL for offline talks.
 */
export function ProductInfoQr({ size = 148, className }: Props) {
  const url = productInfoUrl();
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=0f172a&color=e2e8f0&margin=8`;

  return (
    <div className={className}>
      <img
        src={qrSrc}
        width={size}
        height={size}
        alt="QR code to GridFlex product information"
        className="rounded-lg border border-slate-700 bg-slate-950"
        loading="lazy"
      />
      <p className="mt-2 break-all font-mono text-[11px] text-slate-500">
        {url || PRODUCT_INFO_PATH}
      </p>
    </div>
  );
}
