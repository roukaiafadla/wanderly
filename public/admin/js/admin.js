(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const main = $('#main');
  const modalOverlay = $('#modalOverlay');
  const modalCard = $('#modalCard');
  const toastEl = $('#toast');

  function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function toast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.className = 'toast is-visible' + (isError ? ' is-error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  }

  function closeModal() {
    modalOverlay.classList.remove('is-open');
    modalCard.innerHTML = '';
  }
  function openModal(html) {
    modalCard.innerHTML = html;
    modalOverlay.classList.add('is-open');
  }
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ---------- API helpers ----------

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      window.location.href = '/admin/login.html';
      throw new Error('Not authenticated');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.fields = data.fields || null;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- auth / shell ----------

  async function boot() {
    try {
      const me = await api('GET', '/api/admin/me');
      $('#whoAmI').textContent = me.username;
    } catch {
      return; // api() already redirected
    }
    refreshCounts();
    window.addEventListener('hashchange', route);
    route();
  }

  $('#logoutBtn').addEventListener('click', async () => {
    await api('POST', '/api/admin/logout').catch(() => {});
    window.location.href = '/admin/login.html';
  });

  async function refreshCounts() {
    try {
      const stats = await api('GET', '/api/admin/stats');
      setCount('#countContact', stats.contact_new);
      setCount('#countTrips', stats.trip_new);
    } catch { /* ignore */ }
  }
  function setCount(sel, n) {
    const el = $(sel);
    if (!el) return;
    if (n > 0) { el.textContent = n; el.hidden = false; } else { el.hidden = true; }
  }

  function route() {
    const r = (window.location.hash || '#overview').slice(1);
    $$('.nav-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.route === r));
    const renderers = {
      overview: renderOverview,
      destinations: renderDestinations,
      testimonials: renderTestimonials,
      contact: renderContact,
      trips: renderTrips,
      newsletter: renderNewsletter
    };
    (renderers[r] || renderOverview)();
  }
  $$('.nav-btn').forEach((b) => b.addEventListener('click', () => { window.location.hash = b.dataset.route; }));

  function head(title, sub) {
    return `<div class="main-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
  }

  // ---------- overview ----------

  async function renderOverview() {
    main.innerHTML = head('Overview', 'Snapshot of the site.') + `
      <div class="stats-grid" id="statsGrid"><p class="muted">Loading…</p></div>
      <h2 style="margin:28px 0 0;font-size:16px;">Recent activity</h2>
      <ul class="activity-feed" id="activityFeed"><li class="muted">Loading…</li></ul>
    `;
    try {
      const s = await api('GET', '/api/admin/stats');
      $('#statsGrid').innerHTML = `
        <div class="stat-card"><div class="n">${s.destinations}</div><div class="label">Destinations</div></div>
        <div class="stat-card"><div class="n">${s.testimonials}</div><div class="label">Testimonials</div></div>
        <div class="stat-card"><div class="n">${s.contact_new}</div><div class="label">New contact messages</div></div>
        <div class="stat-card"><div class="n">${s.trip_new}</div><div class="label">New trip requests</div></div>
        <div class="stat-card"><div class="n">${s.newsletter}</div><div class="label">Newsletter subscribers</div></div>
      `;
    } catch {
      $('#statsGrid').innerHTML = '<p class="muted">Couldn\'t load stats.</p>';
    }
    try {
      const { events } = await api('GET', '/api/admin/activity');
      const feed = $('#activityFeed');
      if (!events.length) { feed.innerHTML = '<li class="muted">Nothing yet — new messages, trip requests, and subscribers will show up here.</li>'; return; }
      feed.innerHTML = events.map((e) => `
        <li>
          <span class="activity-badge ${e.type}">${e.type === 'contact' ? 'Message' : e.type === 'trip' ? 'Trip' : 'News'}</span>
          <span class="activity-summary">${escapeHTML(e.summary)}</span>
          <span class="activity-time">${escapeHTML(e.created_at)}</span>
        </li>
      `).join('');
    } catch {
      $('#activityFeed').innerHTML = '<li class="muted">Couldn\'t load activity.</li>';
    }
  }

  // ---------- image upload (shared by destination + testimonial forms) ----------

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function wireImageUpload(fileInput, valueInput, previewImg, statusEl) {
    if (!fileInput) return;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 3_000_000) {
        statusEl.textContent = 'Image is too large (max ~3MB).';
        statusEl.className = 'form-hint error';
        fileInput.value = '';
        return;
      }
      statusEl.textContent = 'Uploading…';
      statusEl.className = 'form-hint';
      try {
        const dataUrl = await fileToDataURL(file);
        const result = await api('POST', '/api/admin/images', { data: dataUrl });
        valueInput.value = result.url;
        previewImg.src = result.url;
        previewImg.style.display = '';
        statusEl.textContent = 'Uploaded.';
      } catch (err) {
        statusEl.textContent = err.message || 'Upload failed.';
        statusEl.className = 'form-hint error';
      }
    });
  }

  // ---------- destinations ----------

  async function renderDestinations() {
    main.innerHTML = head('Destinations', 'Shown on the homepage and directory.') + `
      <div class="toolbar">
        <input type="search" class="table-search" id="destSearch" placeholder="Search by name or country…">
        <button class="btn btn-gold btn-sm" id="addDestBtn">+ Add destination</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Name</th><th>Country</th><th>Price</th><th>Rating</th><th>Tags</th><th>Featured</th><th></th></tr></thead>
        <tbody id="destBody"><tr class="empty-row"><td colspan="8">Loading…</td></tr></tbody>
      </table></div>
    `;
    $('#addDestBtn').addEventListener('click', () => openDestModal());
    try {
      const { destinations } = await api('GET', '/api/destinations');
      const body = $('#destBody');

      function renderRows(list) {
        if (!list.length) {
          body.innerHTML = `<tr class="empty-row"><td colspan="8">${destinations.length ? 'No matches.' : 'No destinations yet.'}</td></tr>`;
          return;
        }
        body.innerHTML = list.map((d) => `
          <tr data-id="${d.id}">
            <td><img class="thumb" src="${escapeHTML(d.image)}" alt=""></td>
            <td><strong>${escapeHTML(d.name)}</strong></td>
            <td>${escapeHTML(d.country)}</td>
            <td>$${d.price_from}</td>
            <td>${Number(d.rating).toFixed(1)}</td>
            <td>${d.tags.slice(0, 3).map((t) => `<span class="tag-pill">${escapeHTML(t)}</span>`).join('')}</td>
            <td>${d.featured ? 'Yes' : '—'}</td>
            <td class="cell-actions">
              <button class="btn btn-ghost btn-sm" data-edit>Edit</button>
              <button class="btn btn-danger btn-sm" data-delete>Delete</button>
            </td>
          </tr>
        `).join('');
      }
      renderRows(destinations);

      $('#destSearch').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        renderRows(!q ? destinations : destinations.filter((d) => d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q)));
      });

      body.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        const id = row.dataset.id;
        const dest = destinations.find((d) => String(d.id) === id);
        if (e.target.closest('[data-edit]')) openDestModal(dest);
        if (e.target.closest('[data-delete]')) deleteDestination(dest);
      });
    } catch {
      $('#destBody').innerHTML = '<tr class="empty-row"><td colspan="8">Couldn\'t load destinations.</td></tr>';
    }
  }

  function openDestModal(dest) {
    const isEdit = Boolean(dest);
    openModal(`
      <h2>${isEdit ? 'Edit' : 'Add'} destination</h2>
      <form id="destForm" novalidate>
        <div class="field" data-field="name"><label>Name</label><input name="name" value="${escapeHTML(dest?.name || '')}" required><span class="error-msg"></span></div>
        <div class="field" data-field="country"><label>Country</label><input name="country" value="${escapeHTML(dest?.country || '')}" required><span class="error-msg"></span></div>
        <div class="field-row">
          <div class="field" data-field="price_from"><label>Price from ($)</label><input type="number" min="0" name="price_from" value="${dest?.price_from ?? ''}" required><span class="error-msg"></span></div>
          <div class="field" data-field="rating"><label>Rating (0–5)</label><input type="number" min="0" max="5" step="0.1" name="rating" value="${dest?.rating ?? ''}" required><span class="error-msg"></span></div>
        </div>
        <div class="field" data-field="image">
          <label>Image</label>
          <div class="image-field">
            <img class="image-preview" id="destImagePreview" src="${escapeHTML(dest?.image || '')}" alt="" style="${dest?.image ? '' : 'display:none;'}">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" id="destImageFile">
            <input type="hidden" name="image" id="destImageValue" value="${escapeHTML(dest?.image || '')}" required>
            <p class="form-hint" id="destImageStatus">Upload a photo, or it'll keep the current one if left blank.</p>
          </div>
          <span class="error-msg"></span>
        </div>
        <div class="field" data-field="tags"><label>Tags (comma separated)</label><input name="tags" value="${escapeHTML((dest?.tags || []).join(', '))}"></div>
        <div class="field" data-field="blurb"><label>Blurb</label><textarea name="blurb" rows="3">${escapeHTML(dest?.blurb || '')}</textarea></div>
        <div class="field-row">
          <div class="field" data-field="review_count"><label>Review count</label><input type="number" min="0" name="review_count" value="${dest?.review_count ?? 0}"></div>
          <div class="field" data-field="sort_order"><label>Sort order</label><input type="number" name="sort_order" value="${dest?.sort_order ?? 0}"></div>
        </div>
        <div class="field checkbox-row"><input type="checkbox" id="destFeatured" name="featured" ${dest?.featured ? 'checked' : ''}><label for="destFeatured">Featured on homepage</label></div>
        <p class="form-note" id="destNote"></p>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="submit" class="btn btn-gold">${isEdit ? 'Save changes' : 'Add destination'}</button>
        </div>
      </form>
    `);
    $('[data-close]', modalCard).addEventListener('click', closeModal);
    wireImageUpload($('#destImageFile', modalCard), $('#destImageValue', modalCard), $('#destImagePreview', modalCard), $('#destImageStatus', modalCard));
    $('#destForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('[data-field]', modalCard).forEach((f) => f.classList.remove('has-error'));
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name'), country: fd.get('country'), price_from: fd.get('price_from'),
        rating: fd.get('rating'), image: fd.get('image'), tags: fd.get('tags'), blurb: fd.get('blurb'),
        review_count: fd.get('review_count'), sort_order: fd.get('sort_order'), featured: fd.get('featured') === 'on'
      };
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        if (isEdit) await api('PUT', `/api/admin/destinations/${dest.id}`, payload);
        else await api('POST', '/api/admin/destinations', payload);
        closeModal();
        toast(isEdit ? 'Destination updated.' : 'Destination added.');
        renderDestinations();
        refreshCounts();
      } catch (err) {
        if (err.fields) Object.entries(err.fields).forEach(([k, v]) => {
          const wrap = modalCard.querySelector(`[data-field="${k}"]`);
          if (wrap) { wrap.classList.add('has-error'); wrap.querySelector('.error-msg').textContent = v; }
        });
        $('#destNote').textContent = err.message;
        $('#destNote').className = 'form-note error';
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function deleteDestination(dest) {
    if (!confirm(`Delete "${dest.name}"? This can't be undone.`)) return;
    try {
      await api('DELETE', `/api/admin/destinations/${dest.id}`);
      toast('Destination deleted.');
      renderDestinations();
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------- testimonials ----------

  async function renderTestimonials() {
    main.innerHTML = head('Testimonials', 'Shown in the homepage carousel.') + `
      <div class="toolbar">
        <input type="search" class="table-search" id="testiSearch" placeholder="Search by name or trip…">
        <button class="btn btn-gold btn-sm" id="addTestiBtn">+ Add testimonial</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>Name</th><th>Trip</th><th>Quote</th><th>Rating</th><th></th></tr></thead>
        <tbody id="testiBody"><tr class="empty-row"><td colspan="5">Loading…</td></tr></tbody>
      </table></div>
    `;
    $('#addTestiBtn').addEventListener('click', () => openTestiModal());
    try {
      const { testimonials } = await api('GET', '/api/testimonials');
      const body = $('#testiBody');

      function renderRows(list) {
        if (!list.length) {
          body.innerHTML = `<tr class="empty-row"><td colspan="5">${testimonials.length ? 'No matches.' : 'No testimonials yet.'}</td></tr>`;
          return;
        }
        body.innerHTML = list.map((t) => `
          <tr data-id="${t.id}">
            <td><img class="thumb" style="border-radius:50%;width:34px;height:34px;" src="${escapeHTML(t.avatar)}" alt=""></td>
            <td><strong>${escapeHTML(t.name)}</strong></td>
            <td>${escapeHTML(t.trip)}</td>
            <td class="muted">${escapeHTML((t.quote || '').slice(0, 60))}${t.quote.length > 60 ? '…' : ''}</td>
            <td>${t.rating} ★</td>
            <td class="cell-actions">
              <button class="btn btn-ghost btn-sm" data-edit>Edit</button>
              <button class="btn btn-danger btn-sm" data-delete>Delete</button>
            </td>
          </tr>
        `).join('');
      }
      renderRows(testimonials);

      $('#testiSearch').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        renderRows(!q ? testimonials : testimonials.filter((t) => t.name.toLowerCase().includes(q) || (t.trip || '').toLowerCase().includes(q)));
      });

      body.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        const t = testimonials.find((x) => String(x.id) === row.dataset.id);
        if (e.target.closest('[data-edit]')) openTestiModal(t);
        if (e.target.closest('[data-delete]')) deleteTestimonial(t);
      });
    } catch {
      $('#testiBody').innerHTML = '<tr class="empty-row"><td colspan="5">Couldn\'t load testimonials.</td></tr>';
    }
  }

  function openTestiModal(t) {
    const isEdit = Boolean(t);
    openModal(`
      <h2>${isEdit ? 'Edit' : 'Add'} testimonial</h2>
      <form id="testiForm" novalidate>
        <div class="field" data-field="name"><label>Name</label><input name="name" value="${escapeHTML(t?.name || '')}" required><span class="error-msg"></span></div>
        <div class="field" data-field="trip"><label>Trip</label><input name="trip" placeholder="e.g. Santorini, 2025" value="${escapeHTML(t?.trip || '')}"></div>
        <div class="field" data-field="avatar">
          <label>Avatar</label>
          <div class="image-field">
            <img class="image-preview" id="testiImagePreview" src="${escapeHTML(t?.avatar || '')}" alt="" style="${t?.avatar ? 'border-radius:50%;' : 'display:none;'}">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" id="testiImageFile">
            <input type="hidden" name="avatar" id="testiImageValue" value="${escapeHTML(t?.avatar || '')}" required>
            <p class="form-hint" id="testiImageStatus">Upload a photo, or it'll keep the current one if left blank.</p>
          </div>
          <span class="error-msg"></span>
        </div>
        <div class="field" data-field="quote"><label>Quote</label><textarea name="quote" rows="3" required>${escapeHTML(t?.quote || '')}</textarea><span class="error-msg"></span></div>
        <div class="field-row">
          <div class="field" data-field="rating"><label>Rating (1–5)</label><input type="number" min="1" max="5" name="rating" value="${t?.rating ?? 5}"></div>
          <div class="field" data-field="sort_order"><label>Sort order</label><input type="number" name="sort_order" value="${t?.sort_order ?? 0}"></div>
        </div>
        <p class="form-note" id="testiNote"></p>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="submit" class="btn btn-gold">${isEdit ? 'Save changes' : 'Add testimonial'}</button>
        </div>
      </form>
    `);
    $('[data-close]', modalCard).addEventListener('click', closeModal);
    wireImageUpload($('#testiImageFile', modalCard), $('#testiImageValue', modalCard), $('#testiImagePreview', modalCard), $('#testiImageStatus', modalCard));
    $('#testiForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('[data-field]', modalCard).forEach((f) => f.classList.remove('has-error'));
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        if (isEdit) await api('PUT', `/api/admin/testimonials/${t.id}`, payload);
        else await api('POST', '/api/admin/testimonials', payload);
        closeModal();
        toast(isEdit ? 'Testimonial updated.' : 'Testimonial added.');
        renderTestimonials();
      } catch (err) {
        if (err.fields) Object.entries(err.fields).forEach(([k, v]) => {
          const wrap = modalCard.querySelector(`[data-field="${k}"]`);
          if (wrap) { wrap.classList.add('has-error'); wrap.querySelector('.error-msg').textContent = v; }
        });
        $('#testiNote').textContent = err.message;
        $('#testiNote').className = 'form-note error';
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function deleteTestimonial(t) {
    if (!confirm(`Delete testimonial from "${t.name}"?`)) return;
    try {
      await api('DELETE', `/api/admin/testimonials/${t.id}`);
      toast('Testimonial deleted.');
      renderTestimonials();
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------- contact messages ----------

  async function renderContact() {
    main.innerHTML = head('Contact messages', 'Submissions from the contact form.') + `
      <div class="toolbar"><input type="search" class="table-search" id="contactSearch" placeholder="Search by name or email…"><div></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>From</th><th>Message</th><th>Received</th><th>Status</th><th></th></tr></thead>
        <tbody id="contactBody"><tr class="empty-row"><td colspan="5">Loading…</td></tr></tbody>
      </table></div>
    `;
    try {
      const { messages } = await api('GET', '/api/admin/contact-messages');
      const body = $('#contactBody');

      function renderRows(list) {
        if (!list.length) { body.innerHTML = `<tr class="empty-row"><td colspan="5">${messages.length ? 'No matches.' : 'No messages yet.'}</td></tr>`; return; }
        body.innerHTML = list.map((m) => `
          <tr data-id="${m.id}">
            <td><strong>${escapeHTML(m.full_name)}</strong><br><span class="muted">${escapeHTML(m.email)}</span></td>
            <td style="max-width:340px;">${escapeHTML(m.message)}</td>
            <td class="muted">${escapeHTML(m.created_at)}</td>
            <td>${statusSelect(m.id, m.status, ['new', 'read', 'archived'], 'contact')}</td>
            <td><button class="btn btn-danger btn-sm" data-delete>Delete</button></td>
          </tr>
        `).join('');
      }
      renderRows(messages);

      $('#contactSearch').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        renderRows(!q ? messages : messages.filter((m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)));
      });

      wireLeadRow(body, 'contact', messages);
    } catch {
      $('#contactBody').innerHTML = '<tr class="empty-row"><td colspan="5">Couldn\'t load messages.</td></tr>';
    }
  }

  // ---------- trip requests ----------

  async function renderTrips() {
    main.innerHTML = head('Trip requests', '"Plan my trip" submissions.') + `
      <div class="toolbar"><input type="search" class="table-search" id="tripsSearch" placeholder="Search by name, email, destination…"><div></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>From</th><th>Destination</th><th>Travelers</th><th>Start</th><th>Budget</th><th>Received</th><th>Status</th><th></th></tr></thead>
        <tbody id="tripsBody"><tr class="empty-row"><td colspan="8">Loading…</td></tr></tbody>
      </table></div>
    `;
    try {
      const { requests } = await api('GET', '/api/admin/trip-requests');
      const body = $('#tripsBody');

      function renderRows(list) {
        if (!list.length) { body.innerHTML = `<tr class="empty-row"><td colspan="8">${requests.length ? 'No matches.' : 'No trip requests yet.'}</td></tr>`; return; }
        body.innerHTML = list.map((r) => `
          <tr data-id="${r.id}">
            <td><strong>${escapeHTML(r.full_name)}</strong><br><span class="muted">${escapeHTML(r.email)}</span></td>
            <td>${escapeHTML(r.destination || '—')}</td>
            <td>${r.travelers}</td>
            <td>${escapeHTML(r.start_date || '—')}</td>
            <td>${escapeHTML(r.budget || '—')}</td>
            <td class="muted">${escapeHTML(r.created_at)}</td>
            <td>${statusSelect(r.id, r.status, ['new', 'contacted', 'booked', 'archived'], 'trips')}</td>
            <td><button class="btn btn-danger btn-sm" data-delete>Delete</button></td>
          </tr>
        `).join('');
      }
      renderRows(requests);

      $('#tripsSearch').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        renderRows(!q ? requests : requests.filter((r) =>
          r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (r.destination || '').toLowerCase().includes(q)));
      });

      wireLeadRow(body, 'trips', requests);
    } catch {
      $('#tripsBody').innerHTML = '<tr class="empty-row"><td colspan="8">Couldn\'t load trip requests.</td></tr>';
    }
  }

  function statusSelect(id, current, options, kind) {
    return `<select class="status-select" data-status data-kind="${kind}">
      ${options.map((o) => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('')}
    </select>`;
  }

  function wireLeadRow(body, kind, items) {
    const endpoint = kind === 'contact' ? 'contact-messages' : 'trip-requests';
    body.addEventListener('change', async (e) => {
      const select = e.target.closest('[data-status]');
      if (!select) return;
      const row = e.target.closest('tr[data-id]');
      try {
        await api('PATCH', `/api/admin/${endpoint}/${row.dataset.id}`, { status: select.value });
        toast('Status updated.');
        refreshCounts();
      } catch (err) {
        toast(err.message, true);
      }
    });
    body.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-delete]')) return;
      const row = e.target.closest('tr[data-id]');
      if (!confirm('Delete this entry? This can\'t be undone.')) return;
      try {
        await api('DELETE', `/api/admin/${endpoint}/${row.dataset.id}`);
        row.remove();
        toast('Deleted.');
        refreshCounts();
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  // ---------- newsletter ----------

  async function renderNewsletter() {
    main.innerHTML = head('Newsletter subscribers', 'Footer signup list.') + `
      <div class="toolbar"><input type="search" class="table-search" id="newsSearch" placeholder="Search by email…"><div></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Email</th><th>Subscribed</th><th></th></tr></thead>
        <tbody id="newsBody"><tr class="empty-row"><td colspan="3">Loading…</td></tr></tbody>
      </table></div>
    `;
    try {
      const { subscribers } = await api('GET', '/api/admin/newsletter');
      const body = $('#newsBody');

      function renderRows(list) {
        if (!list.length) { body.innerHTML = `<tr class="empty-row"><td colspan="3">${subscribers.length ? 'No matches.' : 'No subscribers yet.'}</td></tr>`; return; }
        body.innerHTML = list.map((s) => `
          <tr data-id="${s.id}">
            <td>${escapeHTML(s.email)}</td>
            <td class="muted">${escapeHTML(s.created_at)}</td>
            <td><button class="btn btn-danger btn-sm" data-delete>Remove</button></td>
          </tr>
        `).join('');
      }
      renderRows(subscribers);

      $('#newsSearch').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        renderRows(!q ? subscribers : subscribers.filter((s) => s.email.toLowerCase().includes(q)));
      });

      body.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-delete]')) return;
        const row = e.target.closest('tr[data-id]');
        if (!confirm('Remove this subscriber?')) return;
        try {
          await api('DELETE', `/api/admin/newsletter/${row.dataset.id}`);
          row.remove();
          toast('Removed.');
        } catch (err) {
          toast(err.message, true);
        }
      });
    } catch {
      $('#newsBody').innerHTML = '<tr class="empty-row"><td colspan="3">Couldn\'t load subscribers.</td></tr>';
    }
  }

  boot();
})();
