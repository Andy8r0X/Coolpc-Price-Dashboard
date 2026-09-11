'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loadTrends, findProductById } from '@/lib/data';
import TrendChart from '@/components/TrendChart';

export default function ProductPage() {
  const params = useParams();
  const id = params.id;
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    loadTrends()
      .then((trends) => {
        const p = findProductById(trends, id);
        if (!p) setError('找不到此商品');
        else setProduct(p);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="empty">{error}</div>;
  if (!product) return <div className="empty">載入中...</div>;

  return (
    <div className="product-detail">
      <h1>{product.name}</h1>
      <p className="meta" style={{ color: 'var(--muted)' }}>{product.category}</p>
      <div className="price">NT$ {product.current.toLocaleString()}</div>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        歷史區間：NT$ {product.min.toLocaleString()} ~ {product.max.toLocaleString()}　
        漲跌：{product.change > 0 ? '+' : ''}{product.change} ({product.changePct}%)
      </p>
      <div className="chart">
        <TrendChart points={product.points} name={product.name} />
      </div>
    </div>
  );
}
