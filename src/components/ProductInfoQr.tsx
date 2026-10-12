import React from 'react';
import { PRODUCT_INFO_PATH } from '../lib/demoJourney';
import { getFrontendReleaseIdentity } from '../lib/frontendRelease';

type Props = {
  size?: number;
  className?: string;
};

/**
 * Locally generated QR asset (public/product-info-qr.svg) — works offline.
 * Encodes the public product-info URL used for judges' phones.
 */
export function ProductInfoQr({ size = 148, className }: Props) {
  const origin =
    getFrontendReleaseIdentity().publicOrigin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://gridflex-frontend.onrender.com');
  const url = `${origin.replace(/\/$/, '')}${PRODUCT_INFO_PATH}`;

  return (
    <div className={className}>
      <img
        src="/product-info-qr.svg"
        width={size}
        height={size}
        alt="QR code to GridFlex product information"
        className="rounded-lg border border-slate-700 bg-white p-1"
        loading="lazy"
      />
      <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{url}</p>
    </div>
  );
}
