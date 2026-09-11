const BASE = './data';
let allProducts = [];
let allTrends = [];
let chartInstance = null;

async function loadJson(file) {
  const res = await fetch(`${BASE}/${file}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${file} not found`);
  return res.json();
}

async function init() {
  try {
    const [products, trends, meta] = await Promise.all([
      loadJson('products.json'),
      loadJson('trends.json'),
      loadJson('meta.json'),
    ]);

    allProducts = products;
    allTrends = trends;

    document.getElementById('meta').textContent =
      `最新快照：${meta.latestSnapshot || '—'}`;

    renderStats(meta);
    renderCategoryOptions(products);
    renderGrid();
    bindEvents();
  } catch (e) {
    console.error(e);
    document.getElementById('grid').innerHTML =
      `<div class="empty"><h2>資料尚未產生</h2>
       <p>請先執行 <code>npm run scrape && npm run process</code>，或等待 GitHub Actions 完成。</p>
       <p style="font-size:12px;color:#666">${e.message}</p></div>`;
  }
}

function renderStats(meta) {
  const stats = [
    { label: '商品總數', value: meta.productCount },
    { label: '快照筆數', value: meta.snapshotCount },
    { label: '最新快照', value: meta.latestSnapshot || '—' },
    { label: '最早快照', value: meta.earliestSnapshot || '—' },
  ];
  document.getElementById('stats').innerHTML = stats
    .map(s => `<div class="stat"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`)
    .join('');
}

function renderCategoryOptions(products) {
  const cats = [...new Set(products.map(p => p.category))].sort();
  const sel = document.getElementById('category');
  sel.innerHTML = '<option value="">全部分類</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function getFiltered() {
  const q = document.getElementById('search').value.trim().toUpperCase();
  const cat = document.getElementById('category').value;
  const sort = document.getElementById('sort').value;
  const onlyChanged = document.getElementById('onlyChanged').checked;
  const onlyHot = document.getElementById('onlyHot').checked;

  let list = allProducts;
  if (q) list = list.filter(p => p.name.toUpperCase().includes(q));
  if (cat) list = list.filter(p => p.category === cat);
  if (onlyChanged) list = list.filter(p => p.isPriceChanged);
  if (onlyHot) list = list.filter(p => p.isHot);

  const sorted = [...list];
  switch (sort) {
    case 'changeDesc': sorted.sort((a,b) => b.changePct - a.changePct); break;
    case 'changeAsc':  sorted.sort((a,b) => a.changePct - b.changePct); break;
    case 'priceDesc':  sorted.sort((a,b) => b.price - a.price); break;
    case 'priceAsc':   sorted.sort((a,b) => a.price - b.price); break;
    case 'name':       sorted.sort((a,b) => a.name.localeCompare(b.name)); break;
  }
  return sorted;
}

function renderGrid() {
  const list = getFiltered();
  const grid = document.getElementById('grid');

  if (list.length === 0) {
    grid.innerHTML = '<div class="empty">沒有符合條件的商品</div>';
    return;
  }

  grid.innerHTML = list.map(p => {
    const cls = p.change > 0 ? 'up' : p.change < 0 ? 'down' : '';
    const sign = p.change > 0 ? '+' : '';
    const spark = buildSpark(p.spark || []);
    return `
      <div class="card" data-id="${p.id}">
        <div class="title">${escapeHtml(p.name)}</div>
        <div class="cat">${escapeHtml(p.category)}</div>
        <div class="price-row">
          <div class="price">NT$ ${p.price.toLocaleString()}</div>
          <div class="change ${cls}">${sign}${p.change} (${sign}${p.changePct}%)</div>
        </div>
        <div class="badges">
          ${p.isHot ? '<span class="badge hot">熱賣</span>' : ''}
          ${p.isPriceChanged ? '<span class="badge changed">價格異動</span>' : ''}
        </div>
        <svg viewBox="0 0 100 30" class="spark" preserveAspectRatio="none">${spark}</svg>
      </div>`;
  }).join('');

  // 綁點擊
  grid.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.id));
  });
}

function buildSpark(values) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 100 / (values.length - 1);
  const d = values.map((v, i) => {
    const x = i * stepX;
    const y = 28 - ((v - min) / range) * 26;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<path d="${d}" fill="none" stroke="#4a9eff" stroke-width="1.5" />`;
}

function openModal(id) {
  const trend = allTrends.find(t => t.id === id);
  if (!trend) return;

  document.getElementById('modalTitle').textContent = trend.name;
  document.getElementById('modalSub').textContent = trend.category;
  document.getElementById('modalPrice').textContent = `NT$ ${trend.current.toLocaleString()}`;

  document.getElementById('modal').classList.add('open');

  setTimeout(() => {
    const el = document.getElementById('chart');
    if (!chartInstance) chartInstance = echarts.init(el, 'dark');
    chartInstance.setOption({
      backgroundColor: 'transparent',
      grid: { left: 60, right: 20, top: 30, bottom: 40 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: trend.points.map(p => p.t.slice(0, 16)),
        axisLabel: { color: '#8b93a7', fontSize: 11 },
      },
      yAxis: {
        type: 'value', scale: true,
        axisLabel: { color: '#8b93a7', fontSize: 11, formatter: v => v.toLocaleString() },
        splitLine: { lineStyle: { color: '#262b36' } },
      },
      series: [{
        type: 'line',
        data: trend.points.map(p => p.p),
        smooth: true,
        lineStyle: { color: '#4a9eff', width: 2 },
        itemStyle: { color: '#4a9eff' },
      }],
    }, true);
    chartInstance.resize();
  }, 50);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function bindEvents() {
  ['search','category','sort','onlyChanged','onlyHot'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', renderGrid);
    el.addEventListener('change', renderGrid);
  });
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

init();
