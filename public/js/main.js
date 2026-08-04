(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

  /* ---------- header scroll state ---------- */
  const header = $('#siteHeader');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- mobile nav ---------- */
  const mobileNav = $('#mobileNav');
  const navToggle = $('#navToggle');
  const navClose = $('#navClose');
  const openNav = () => { mobileNav.classList.add('is-open'); navToggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; };
  const closeNav = () => { mobileNav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  navToggle && navToggle.addEventListener('click', openNav);
  navClose && navClose.addEventListener('click', closeNav);
  $$('[data-nav-link]').forEach((a) => a.addEventListener('click', closeNav));

  /* ---------- scroll reveal ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  $$('.reveal').forEach((el) => revealObserver.observe(el));

  /* ---------- modal (Plan My Trip) ---------- */
  const overlay = $('#modalOverlay');
  const openModal = () => {
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    const firstField = $('#tf-name');
    firstField && firstField.focus();
  };
  const closeModal = () => { overlay.classList.remove('is-open'); document.body.style.overflow = ''; };
  $$('[data-open-modal]').forEach((btn) => btn.addEventListener('click', () => { closeNav(); openModal(); }));
  $('#modalClose') && $('#modalClose').addEventListener('click', closeModal);
  overlay && overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeNav(); } });

  /* ---------- helpers: forms ---------- */
  function setFieldError(form, name, message) {
    const wrap = form.querySelector(`[data-field="${name}"]`);
    if (!wrap) return;
    wrap.classList.add('has-error');
    const msg = wrap.querySelector('.error-msg');
    if (msg && message) msg.textContent = message;
  }
  function clearFieldErrors(form) {
    $$('[data-field]', form).forEach((f) => f.classList.remove('has-error'));
  }
  function setNote(noteEl, text, kind) {
    if (!noteEl) return;
    noteEl.textContent = text;
    noteEl.className = 'form-note' + (kind ? ' ' + kind : '');
  }

  async function postJSON(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.error || 'Something went wrong.');
      err.fields = body.fields || null;
      err.status = res.status;
      throw err;
    }
    return body;
  }

  /* ---------- contact form ---------- */
  const contactForm = $('#contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(contactForm);
      const note = $('#contactNote');
      const btn = contactForm.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(contactForm).entries());

      btn.disabled = true;
      setNote(note, 'Sending...', '');
      try {
        await postJSON('/api/contact', data);
        setNote(note, 'Message sent — we\'ll be in touch within a business day.', 'success');
        contactForm.reset();
      } catch (err) {
        if (err.fields) Object.entries(err.fields).forEach(([k, v]) => setFieldError(contactForm, k, v));
        setNote(note, err.message || 'Could not send your message. Please try again.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------- trip request form ---------- */
  const tripForm = $('#tripForm');
  if (tripForm) {
    tripForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(tripForm);
      const note = $('#tripNote');
      const btn = tripForm.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(tripForm).entries());

      btn.disabled = true;
      setNote(note, 'Sending...', '');
      try {
        await postJSON('/api/trip-requests', data);
        setNote(note, 'Got it — a travel designer will reach out shortly.', 'success');
        tripForm.reset();
        setTimeout(closeModal, 1400);
      } catch (err) {
        if (err.fields) Object.entries(err.fields).forEach(([k, v]) => setFieldError(tripForm, k, v));
        setNote(note, err.message || 'Could not send your request. Please try again.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ---------- newsletter form ---------- */
  const newsletterForm = $('#newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = $('#newsletterNote');
      const data = Object.fromEntries(new FormData(newsletterForm).entries());
      try {
        await postJSON('/api/newsletter', data);
        setNote(note, 'Subscribed — welcome aboard.', 'success');
        newsletterForm.reset();
      } catch (err) {
        setNote(note, err.message || 'Could not subscribe right now.', 'error');
      }
    });
  }

  /* ---------- destinations ---------- */
  function starString(rating) {
    const full = Math.round(rating);
    return '\u2605'.repeat(full) + '\u2606'.repeat(5 - full);
  }

  function destCardHTML(d) {
    return `
      <article class="dest-card">
        <div class="dest-thumb">
          <img src="${d.image}" alt="${d.name}, ${d.country}" width="900" height="675" loading="lazy">
          <span class="dest-price">From $${d.price_from}</span>
        </div>
        <div class="dest-body">
          <div class="place">
            <h3>${d.name}</h3>
          </div>
          <p class="dest-country">${d.country}</p>
          <div class="dest-tags">
            ${d.tags.slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join('')}
          </div>
          <div class="dest-rating">
            <span class="stars">${starString(d.rating)}</span>
            <span>${d.rating.toFixed(1)}</span>
          </div>
        </div>
      </article>
    `;
  }
  window.WanderlyDestCard = destCardHTML;

  async function loadFeaturedDestinations() {
    const grid = $('#destGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/destinations?featured=true');
      const { destinations } = await res.json();
      grid.innerHTML = destinations.map(destCardHTML).join('');
    } catch {
      grid.innerHTML = '<p style="color:var(--ink-soft);">Couldn\'t load destinations right now — please refresh.</p>';
    }
  }
  loadFeaturedDestinations();

  async function populateDestinationSelect() {
    const select = $('#tf-destination');
    if (!select) return;
    try {
      const res = await fetch('/api/destinations');
      const { destinations } = await res.json();
      destinations.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = `${d.name}, ${d.country}`;
        opt.textContent = `${d.name}, ${d.country}`;
        select.appendChild(opt);
      });
    } catch { /* select still usable with the default option */ }
  }
  populateDestinationSelect();

  /* ---------- testimonials carousel ---------- */
  async function loadTestimonials() {
    const track = $('#testiTrack');
    if (!track) return;
    let items = [];
    try {
      const res = await fetch('/api/testimonials');
      items = (await res.json()).testimonials;
    } catch {
      track.innerHTML = '';
      return;
    }

    track.innerHTML = items.map((t) => `
      <article class="testi-card">
        <div class="testi-top">
          <img class="testi-avatar" src="${t.avatar}" alt="" width="46" height="46">
          <div>
            <strong>${t.name}</strong>
            <span>${t.trip}</span>
          </div>
        </div>
        <p class="testi-quote">${t.quote}</p>
        <span class="testi-quote-mark">"</span>
      </article>
    `).join('');

    const cards = $$('.testi-card', track);
    let active = Math.min(1, cards.length - 1);
    const mark = () => cards.forEach((c, i) => c.classList.toggle('is-active', i === active));
    mark();

    const perView = () => (window.innerWidth <= 640 ? 1 : window.innerWidth <= 1080 ? 2 : 3);

    function go(dir) {
      active = Math.max(0, Math.min(cards.length - 1, active + dir));
      mark();
      const card = cards[active];
      if (!card) return;
      const trackWrap = track.parentElement;
      const offset = card.offsetLeft - (trackWrap.clientWidth - card.clientWidth) / 2;
      track.style.transform = `translateX(-${Math.max(0, offset)}px)`;
    }

    $('#testiPrev') && $('#testiPrev').addEventListener('click', () => go(-1));
    $('#testiNext') && $('#testiNext').addEventListener('click', () => go(1));
    window.addEventListener('resize', () => go(0));
  }
  loadTestimonials();
})();
