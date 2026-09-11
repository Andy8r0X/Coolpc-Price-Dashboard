'use client';
import { useEffect, useMemo, useState } from 'react';
import { loadMeta, loadProducts } from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import FilterBar from '@/components/FilterBar';

export default function HomePage() {
  const [meta, setMeta] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('changeDesc');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [onlyHot, setOnlyHot] = useState(false);

  useEffect(() => {
    Promise.all([loadMeta(), loadProducts()])
      .then(([m, p]) => { setMeta(m); setProducts(p); })
      .catch((e) => setError(e.message));
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  const filtered = useMemo(() => {
    let list = products;
    if (query) {
      const q = query.toUpperCase();
      list = list.filter((p) => p.name.toUpperCase().includes(q));
    }
    if (category) list = list.filter((p) => p.category === category);
    if (onlyChanged) list = list.filter((p) => p.isPriceChanged);
    if (onlyHot) list = list.filter((p) => p.isHot);

    const sorted = [...list];
    switch (sort) {
      case 'changeDesc': sorted.sort((a, b) => b.changePct - a.changePct); break;
      case 'changeAsc':  sorted.sort((a, b) => a.changePct - b.changePct); break;
      case 'priceDesc':  sorted.sort((a, b) => b.price - a.price); break;
      case 'priceAsc':   sorted.sort((a, b) => a.price - b.price); break;
      case 'name':       sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return sorted;
  }, [products, query, category, sort, onlyChanged, onlyHot]);

  if (error) {
    return (
      <div className="empty">
        <h2>資料尚未產生</h2>
        <p>{error}</p>
        <p>請先執行 <code>npm run scrape && npm run process</code>，或等待 GitHub Actions 完成。</p>
      </div>
    );
  }

  return (
    <>
      {meta && (
        <div className="stat-grid">
          <div className="stat-card"><div className="label">商品總數</div><div className="value">{meta.productCount}</div></div>
          <div className="stat-card"><div className="label">快照筆數</div><div className="value">{meta.snapshotCount}</div></div>
          <div className="stat-card"><div className="label">最新快照</div><div className="value" style={{ fontSize: 14 }}>{meta.latestSnapshot || '—'}</div></div>
          <div className="stat-card"><div className="label">最早快照</div><div className="value" style={{ fontSize: 14 }}>{meta.earliestSnapshot || '—'}</div></div>
        </div>
      )}

      <FilterBar
        query={query} setQuery={setQuery}
        category={category} setCategory={setCategory} categories={categories}
        sort={sort} setSort={setSort}
        onlyChanged={onlyChanged} setOnlyChanged={setOnlyChanged}
        onlyHot={onlyHot} setOnlyHot={setOnlyHot}
      />

      {filtered.length === 0 ? (
        <div className="empty">沒有符合條件的商品</div>
      ) : (
        <div className="grid">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </>
  );
}
