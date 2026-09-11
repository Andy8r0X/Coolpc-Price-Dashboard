'use client';
import Link from 'next/link';
import { useMemo } from 'react';

export default function ProductCard({ product }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const changeClass = product.change > 0 ? 'up' : product.change < 0 ? 'down' : '';
  const changeSign = product.change > 0 ? '+' : '';

  const sparkPath = useMemo(() => buildSparkPath(product.spark || []), [product.spark]);

  return (
    <Link href={`${base}/product/?id=${product.id}`} className="card">
      <div className="title">{product.name}</div>
      <div className="meta">{product.category}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="price">NT$ {product.price.toLocaleString()}</div>
        <div className={`change ${changeClass}`}>
          {changeSign}{product.change} ({changeSign}{product.changePct}%)
        </div>
      </div>
      <div>
        {product.isHot && <span className="badge hot">熱賣</span>}
        {product.isPriceChanged && <span className="badge changed">價格異動</span>}
      </div>
      <svg viewBox="0 0 100 30" className="spark" preserveAspectRatio="none">
        <path d={sparkPath} fill="none" stroke="#4a9eff" strokeWidth="1.5" />
      </svg>
    </Link>
  );
}

function buildSparkPath(values) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 100 / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = 28 - ((v - min) / range) * 26;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
