(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const grid = $('#listingGrid');
  const empty = $('#emptyState');
  const search = $('#searchInput');
  const chipsWrap = $('#filterChips');
  if (!grid) return;

  let all = [];
  let activeTag = 'all';

  function render() {
    const q = (search.value || '').trim().toLowerCase();
    const filtered = all.filter((d) => {
      const matchesTag = activeTag === 'all' || d.tags.some((t) => t.toLowerCase() === activeTag);
      const haystack = `${d.name} ${d.country}`.toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      return matchesTag && matchesSearch;
    });

    grid.innerHTML = filtered.map((d) => window.WanderlyDestCard(d)).join('');
    empty.hidden = filtered.length !== 0;
  }

  async function init() {
    try {
      const res = await fetch('/api/destinations');
      const data = await res.json();
      all = data.destinations;

      const tagSet = new Set();
      all.forEach((d) => d.tags.forEach((t) => tagSet.add(t)));
      Array.from(tagSet).sort().forEach((tag) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.dataset.tag = tag.toLowerCase();
        btn.textContent = tag;
        chipsWrap.appendChild(btn);
      });

      render();
    } catch {
      grid.innerHTML = '';
      empty.hidden = false;
      empty.textContent = 'Couldn\'t load destinations right now — please refresh.';
    }
  }

  chipsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    activeTag = btn.dataset.tag;
    $$('.chip', chipsWrap).forEach((c) => c.classList.toggle('is-active', c === btn));
    render();
  });

  let debounce;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 150);
  });

  init();
})();
