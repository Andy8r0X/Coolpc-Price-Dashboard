'use client';

export default function FilterBar({
  query, setQuery,
  category, setCategory,
  categories,
  sort, setSort,
  onlyChanged, setOnlyChanged,
  onlyHot, setOnlyHot,
}) {
  return (
    <div className="filter-bar">
      <input
        placeholder="搜尋商品名稱..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">全部分類</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="changeDesc">漲幅最多</option>
        <option value="changeAsc">跌幅最多</option>
        <option value="priceDesc">價格高→低</option>
        <option value="priceAsc">價格低→高</option>
        <option value="name">名稱</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
        <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
        只看價格異動
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
        <input type="checkbox" checked={onlyHot} onChange={(e) => setOnlyHot(e.target.checked)} />
        只看熱賣
      </label>
    </div>
  );
}
