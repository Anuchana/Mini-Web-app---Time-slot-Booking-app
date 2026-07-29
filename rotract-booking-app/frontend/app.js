// Point this at wherever the FastAPI backend is running.
  const API_BASE = 'https://syncspace-r05n.onrender.com/';

  const DAY_START_MIN = 7 * 60;   // 07:00
  const DAY_END_MIN   = 21 * 60;  // 21:00
  const DAY_SPAN_MIN  = DAY_END_MIN - DAY_START_MIN;

  const CATEGORY_CLASS = { Meeting: 'cat-Meeting', Call: 'cat-Call', Personal: 'cat-Personal', Event: 'cat-Event', Other: 'cat-Other' };

  const el = (id) => document.getElementById(id);
  const viewDateInput = el('viewDate');
  const bookingDateInput = el('booking_date');
  const ruler = el('ruler');
  const track = el('track');
  const emptyState = el('emptyState');
  const lineDateLabel = el('lineDateLabel');
  const bookingList = el('bookingList');
  const bookingForm = el('bookingForm');
  const formMsg = el('formMsg');

  function todayISO(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  function toMinutes(hhmmss){
    const [h, m] = hhmmss.split(':').map(Number);
    return h * 60 + m;
  }

  function formatTime(hhmmss){
    const [h, m] = hhmmss.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = ((h + 11) % 12) + 1;
    return `${hour12}:${String(m).padStart(2,'0')} ${period}`;
  }

  function formatDateLabel(iso){
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function showFormMsg(text, type){
    formMsg.textContent = text;
    formMsg.className = `form-msg show ${type}`;
  }
  function clearFormMsg(){
    formMsg.className = 'form-msg';
    formMsg.textContent = '';
  }

  function buildRuler(){
    ruler.innerHTML = '';
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 120){
      const pct = ((m - DAY_START_MIN) / DAY_SPAN_MIN) * 100;
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = pct + '%';
      const h = Math.floor(m / 60);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = ((h + 11) % 12) + 1;
      tick.textContent = `${hour12}${period}`;
      ruler.appendChild(tick);
    }
  }

  function renderTrack(bookings){
    track.innerHTML = '';
    if (!bookings.length){
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    bookings.forEach((b) => {
      const startMin = clampToDay(toMinutes(b.start_time));
      const endMin = clampToDay(toMinutes(b.end_time));
      if (endMin <= startMin) return;

      const leftPct = ((startMin - DAY_START_MIN) / DAY_SPAN_MIN) * 100;
      const widthPct = ((endMin - startMin) / DAY_SPAN_MIN) * 100;

      const block = document.createElement('div');
      block.className = `block ${CATEGORY_CLASS[b.category] || 'cat-Other'}`;
      block.style.left = leftPct + '%';
      block.style.width = Math.max(widthPct, 1.2) + '%';
      block.title = `${b.name} · ${formatTime(b.start_time)}–${formatTime(b.end_time)}`;
      block.textContent = b.name;
      track.appendChild(block);
    });
  }

  function clampToDay(minutes){
    return Math.min(Math.max(minutes, DAY_START_MIN), DAY_END_MIN);
  }

  function renderList(bookings){
    bookingList.innerHTML = '';
    if (!bookings.length){
      const li = document.createElement('li');
      li.className = 'list-empty';
      li.textContent = 'Nothing reserved for this day yet.';
      bookingList.appendChild(li);
      return;
    }

    bookings.forEach((b) => {
      const li = document.createElement('li');
      li.className = 'booking-card';

      li.innerHTML = `
        <div>
          <p class="who">${escapeHtml(b.name)}</p>
          <p class="when">${formatTime(b.start_time)} – ${formatTime(b.end_time)}</p>
          <span class="badge ${CATEGORY_CLASS[b.category] || 'cat-Other'}">${escapeHtml(b.category)}</span>
          ${b.note ? `<p class="note">${escapeHtml(b.note)}</p>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-danger" data-action="toggle-delete" data-id="${b.id}">Cancel</button>
          <div class="delete-inline" id="delete-row-${b.id}">
            <input type="text" placeholder="Cancellation code" id="delete-code-${b.id}">
            <button class="btn btn-ghost" data-action="confirm-delete" data-id="${b.id}">Confirm</button>
          </div>
        </div>
      `;
      bookingList.appendChild(li);
    });
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function loadBookings(){
    const date = viewDateInput.value;
    lineDateLabel.textContent = formatDateLabel(date);

    try{
      const res = await fetch(`${API_BASE}/api/bookings?filter_date=${date}`);
      const payload = await res.json();
      const bookings = (payload.data || []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
      renderTrack(bookings);
      renderList(bookings);
    } catch (err){
      emptyState.hidden = false;
      emptyState.textContent = "Couldn't reach the schedule. Check that the API is running.";
      bookingList.innerHTML = '<li class="list-empty">Couldn\'t load reservations.</li>';
    }
  }

  bookingList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === 'toggle-delete'){
      const row = el(`delete-row-${id}`);
      row.classList.toggle('show');
      return;
    }

    if (btn.dataset.action === 'confirm-delete'){
      const codeInput = el(`delete-code-${id}`);
      const code = codeInput.value.trim();
      if (!code){
        codeInput.focus();
        return;
      }
      try{
        const res = await fetch(`${API_BASE}/api/bookings/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delete_code: code })
        });
        const payload = await res.json();
        if (!res.ok){
          codeInput.value = '';
          codeInput.placeholder = payload.detail || 'Wrong code';
          codeInput.style.borderColor = 'var(--conflict)';
          return;
        }
        loadBookings();
      } catch (err){
        codeInput.placeholder = 'Could not reach the API';
      }
    }
  });

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormMsg();

    const body = {
      name: el('name').value.trim(),
      booking_date: bookingDateInput.value,
      start_time: el('start_time').value,
      end_time: el('end_time').value,
      category: el('category').value,
      note: el('note').value.trim() || null,
      delete_code: el('delete_code').value.trim()
    };

    if (body.end_time <= body.start_time){
      showFormMsg('The end time has to be after the start time.', 'error');
      return;
    }

    try{
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await res.json();

      if (!res.ok){
        showFormMsg(payload.detail || 'Something went wrong reserving that slot.', 'error');
        return;
      }

      showFormMsg('Slot reserved. It now shows on the line below.', 'success');
      bookingForm.reset();
      el('category').value = 'Meeting';
      bookingDateInput.value = viewDateInput.value;

      if (body.booking_date === viewDateInput.value){
        loadBookings();
      }
    } catch (err){
      showFormMsg("Couldn't reach the API. Is the server running?", 'error');
    }
  });

  viewDateInput.addEventListener('change', loadBookings);

  // init
  (function init(){
    const today = todayISO();
    viewDateInput.value = today;
    bookingDateInput.value = today;
    buildRuler();
    loadBookings();
  })();