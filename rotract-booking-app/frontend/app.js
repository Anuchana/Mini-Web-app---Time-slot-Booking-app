// Point this at wherever the FastAPI backend is running.
  const API_BASE = 'https://syncspace-r05n.onrender.com';
  const DAY_START_MIN = 7 * 60;   // 07:00
  const DAY_END_MIN   = 21 * 60;  // 21:00
  const HOUR_WIDTH = 120; // pixels per hour

  const CATEGORY_CLASS = { Meeting: 'cat-Meeting', Call: 'cat-Call', Personal: 'cat-Personal', Event: 'cat-Event', Other: 'cat-Other' };

  const PERSON_ICON = '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 19c1.2-3.2 3.8-4.9 6.5-4.9s5.3 1.7 6.5 4.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const el = (id) => document.getElementById(id);
  const viewDateInput = el('viewDate');
  const bookingDateInput = el('booking_date');
  const filterCategorySelect = el('filterCategory');
  const ruler = el('ruler');
  const track = el('track');
  const emptyState = el('emptyState');
  const topDateLabel = el('topDateLabel');
  const bookingTableBody = el('bookingTableBody');
  const bookingForm = el('bookingForm');
  const formMsg = el('formMsg');

  const modalOverlay = el('modalOverlay');
  const openModalBtn = el('openModalBtn');
  const modalClose = el('modalClose');

  function openModal(){
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    el('name').focus();
  }
  function closeModal(){
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
  }
  openModalBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
  });

  function todayISO(){
    const d = new Date();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');

    return `${year}-${month}-${day}`;
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

  function formatTopDate(iso){
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function updateTopDate(){
    const today = todayISO();
    topDateLabel.textContent = formatTopDate(today);
  }

  function showFormMsg(text, type){
    formMsg.textContent = text;
    formMsg.className = `form-msg show ${type}`;
  }
  function clearFormMsg(){
    formMsg.className = 'form-msg';
    formMsg.textContent = '';
  }

  function initials(name){
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  }

  function buildRuler(){

    ruler.innerHTML = '';

    const totalHours = (DAY_END_MIN - DAY_START_MIN) / 60;

    const timelineWidth = totalHours * HOUR_WIDTH;

    ruler.style.width = timelineWidth + "px";
    track.style.width = timelineWidth + "px";


    for(let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60){

        const left = ((m - DAY_START_MIN) / 60) * HOUR_WIDTH;

        const tick = document.createElement('div');

        tick.className = 'tick';
        tick.style.left = left + "px";

        const h = Math.floor(m / 60);
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = ((h + 11) % 12) + 1;

        tick.textContent = `${hour12}${period}`;

        ruler.appendChild(tick);
    }
  } 

  function clampToDay(minutes){
    return Math.min(Math.max(minutes, DAY_START_MIN), DAY_END_MIN);
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

      const leftPx = ((startMin - DAY_START_MIN) / 60) * HOUR_WIDTH;
      const widthPx = ((endMin - startMin) / 60) * HOUR_WIDTH;

      const block = document.createElement('div');
      block.className = `block ${CATEGORY_CLASS[b.category] || 'cat-Other'}`;
      block.style.left = leftPx + "px";
      block.style.width = Math.max(widthPx, 80) + "px";
      block.title = `${b.name} · ${formatTime(b.start_time)}–${formatTime(b.end_time)}`;
      block.innerHTML = `
        <span class="name">${PERSON_ICON}${escapeHtml(b.name)}</span>
        <span class="time">${formatTime(b.start_time)} – ${formatTime(b.end_time)}</span>
      `;
      track.appendChild(block);
    });
  }

  function renderTable(bookings){
    bookingTableBody.innerHTML = '';
    if (!bookings.length){
      const tr = document.createElement('tr');
      tr.className = 'list-empty';
      tr.innerHTML = `<td colspan="7">Nothing reserved for this day yet.</td>`;
      bookingTableBody.appendChild(tr);
      return;
    }

    bookings.forEach((b) => {
      const tr = document.createElement('tr');
      const catClass = CATEGORY_CLASS[b.category] || 'cat-Other';

      tr.innerHTML = `
        <td class="cell-when">${formatTime(b.start_time)} – ${formatTime(b.end_time)}</td>
        <td class="cell-title">${escapeHtml(b.name)}</td>
        <td><span class="badge ${catClass}">${escapeHtml(b.category)}</span></td>
        <td>
          <div class="reserved-by">
            <span>${escapeHtml(b.name)}</span>
          </div>
        </td>
        <td class="cell-notes">${b.note ? escapeHtml(b.note) : '<span class="dash">—</span>'}</td>
        <td><span class="badge status-confirmed">Confirmed</span></td>
        <td class="actions-cell">
          <button class="kebab-btn" type="button" data-action="toggle-menu" data-id="${b.id}" aria-label="Actions">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg>
          </button>
          <div class="action-menu" id="menu-${b.id}">
            <p>Cancel this reservation</p>
            <div class="code-row">
              <input type="text" placeholder="Cancellation code" id="delete-code-${b.id}">
              <button class="btn btn-danger" type="button" data-action="confirm-delete" data-id="${b.id}">Confirm</button>
            </div>
          </div>
        </td>
      `;
      bookingTableBody.appendChild(tr);
    });
  }

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function applyFilters(bookings){
    const cat = filterCategorySelect.value;
    if (!cat) return bookings;
    return bookings.filter(b => b.category === cat);
  }
  async function loadBookings(){
    const date = viewDateInput.value;
    
    try{
      const res = await fetch(`${API_BASE}/api/bookings?filter_date=${date}`);
      const payload = await res.json();
      const bookings = (payload.data || []).slice().sort((a, b) => a.start_time.localeCompare(b.start_time));
      const filtered = applyFilters(bookings);
      renderTrack(filtered);
      renderTable(filtered);
    } catch (err){
      emptyState.hidden = false;
      emptyState.textContent = "Couldn't reach the schedule. Check that the API is running.";
      bookingTableBody.innerHTML = '<tr class="list-empty"><td colspan="7">Couldn\'t load reservations.</td></tr>';
    }
  }

  bookingTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === 'toggle-menu'){
      const menu = el(`menu-${id}`);
      const wasOpen = menu.classList.contains('show');
      document.querySelectorAll('.action-menu.show').forEach(m => m.classList.remove('show'));
      if (!wasOpen) menu.classList.add('show');
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

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.actions-cell')){
      document.querySelectorAll('.action-menu.show').forEach(m => m.classList.remove('show'));
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
    const now = new Date();

    const bookingDateTime = new Date(
        `${body.booking_date}T${body.start_time}`
    );

    if (bookingDateTime <= now) {
        showFormMsg(
            "You cannot reserve a time that has already passed.",
            "error"
        );
        return;
    }

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
      setTimeout(closeModal, 900);
    } catch (err){
      showFormMsg("Couldn't reach the API. Is the server running?", 'error');
    }
  });

  viewDateInput.addEventListener('change', loadBookings);
  filterCategorySelect.addEventListener('change', loadBookings);

  // init
  (function init(){
    const today = todayISO();
    viewDateInput.value = today;
    bookingDateInput.value = today;
    buildRuler();
    updateTopDate();
    loadBookings();
    
  })();
