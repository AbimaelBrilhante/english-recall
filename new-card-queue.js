(() => {
  'use strict';

  if (window.__recallNewCardQueueLoaded) return;
  window.__recallNewCardQueueLoaded = true;

  const DEFAULT_LIMITS = { en: 10, de: 5 };

  function ensureQueueSettings() {
    state.settings ||= {};
    state.settings.newCardLimits ||= {};
    for (const deckId of Object.keys(DECKS)) {
      const fallback = DEFAULT_LIMITS[deckId] ?? 10;
      const current = Number(state.settings.newCardLimits[deckId]);
      state.settings.newCardLimits[deckId] = Number.isFinite(current) && current >= 0 ? Math.round(current) : fallback;
    }
  }

  function cardReviewCount(card) {
    return Number(card?.schedules?.recognition?.reps || 0) + Number(card?.schedules?.production?.reps || 0);
  }

  function isUnseen(card) {
    return !card.introducedDay && cardReviewCount(card) === 0;
  }

  function backfillIntroducedDays() {
    const firstDay = new Map();
    for (const log of (state.reviewLog || [])) {
      if (!log?.id || !log?.deckId || !log?.day) continue;
      const key = `${log.deckId}|${log.id}`;
      if (!firstDay.has(key)) firstDay.set(key, log.day);
    }
    for (const deckId of Object.keys(DECKS)) {
      for (const card of (state.cards[deckId] || [])) {
        if (card.introducedDay || cardReviewCount(card) === 0) continue;
        card.introducedDay = firstDay.get(`${deckId}|${card.id}`) || 'legacy';
      }
    }
  }

  function introducedToday(deckId) {
    const today = dayKey();
    return (state.cards[deckId] || []).filter(card => card.introducedDay === today).length;
  }

  function newLimit(deckId) {
    ensureQueueSettings();
    return Number(state.settings.newCardLimits[deckId] ?? DEFAULT_LIMITS[deckId] ?? 10);
  }

  function uniqueCardCount(items) {
    return new Set(items.map(item => item.card.id)).size;
  }

  const baseCandidateItems = candidateItems;
  candidateItems = function(deckId = selectedDeck(), cutoff = Date.now(), mode = selectedMode(deckId)) {
    const items = baseCandidateItems(deckId, cutoff, mode);
    const reviews = [];
    const unseen = [];

    for (const item of items) {
      if (isUnseen(item.card)) unseen.push(item);
      else reviews.push(item);
    }

    const used = introducedToday(deckId);
    const remaining = Math.max(0, newLimit(deckId) - used);
    if (remaining <= 0 || unseen.length === 0) return reviews;

    const allowed = new Set();
    for (const item of unseen) {
      if (allowed.has(item.card.id)) continue;
      if (allowed.size >= remaining) break;
      allowed.add(item.card.id);
    }

    const allowedNew = unseen.filter(item => allowed.has(item.card.id));
    return [...reviews, ...allowedNew];
  };

  const baseRateCard = rateCard;
  rateCard = function(kind) {
    const item = current();
    if (item?.card && isUnseen(item.card)) {
      item.card.introducedDay = dayKey();
      save();
    }
    return baseRateCard(kind);
  };

  function queueStats(deckId) {
    const raw = baseCandidateItems(deckId, endOfDay(), selectedMode(deckId));
    const reviewItems = raw.filter(item => !isUnseen(item.card));
    const unseenItems = raw.filter(item => isUnseen(item.card));
    const limit = newLimit(deckId);
    const introduced = introducedToday(deckId);
    const remaining = Math.max(0, limit - introduced);
    const available = Math.min(remaining, uniqueCardCount(unseenItems));
    return {
      reviews: reviewItems.length,
      introduced,
      limit,
      available,
      waiting: uniqueCardCount(unseenItems)
    };
  }

  function injectStyles() {
    if (document.getElementById('newCardQueueStyle')) return;
    const style = document.createElement('style');
    style.id = 'newCardQueueStyle';
    style.textContent = `
      .nq-panel{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:12px 14px;margin:-2px 0 14px}
      .nq-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
      .nq-head b{font-size:13px;color:var(--ink)}.nq-head span{font-size:11px;color:var(--muted)}
      .nq-limits{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nq-limit{border:1px solid var(--line);background:var(--surface2);color:var(--ink);border-radius:12px;padding:10px;font-weight:800;font-size:12px;text-align:left}
      .nq-limit small{display:block;color:var(--muted);font-weight:700;margin-top:3px}
      .nq-deck-info{margin-top:10px;background:var(--surface2);border-radius:12px;padding:8px 10px;color:var(--muted);font-size:11px;font-weight:750}
      .nq-deck-info b{color:var(--ink)}
      @media(max-width:430px){.nq-limits{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function editLimit(deckId) {
    const current = newLimit(deckId);
    const name = DECKS[deckId]?.name || deckId;
    const raw = prompt(`Quantas frases novas de ${name} por dia?`, String(current));
    if (raw === null) return;
    const value = Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
    state.settings.newCardLimits[deckId] = value;
    save();
    currentItem = null;
    render();
  }

  function ensurePanel() {
    if (document.getElementById('newCardQueuePanel')) return;
    const summary = document.querySelector('.summary');
    if (!summary) return;
    const panel = document.createElement('section');
    panel.id = 'newCardQueuePanel';
    panel.className = 'nq-panel';
    panel.innerHTML = `
      <div class="nq-head"><div><b>Novas x revisões</b><br><span>Revisões vencidas entram primeiro. Depois, novas frases dentro do limite diário.</span></div></div>
      <div class="nq-limits">
        <button id="nqLimitEn" class="nq-limit" type="button"></button>
        <button id="nqLimitDe" class="nq-limit" type="button"></button>
      </div>`;
    const goal = document.getElementById('pfGoal');
    (goal || summary).insertAdjacentElement('afterend', panel);
    document.getElementById('nqLimitEn')?.addEventListener('click', () => editLimit('en'));
    document.getElementById('nqLimitDe')?.addEventListener('click', () => editLimit('de'));
  }

  function updatePanel() {
    ensurePanel();
    for (const deckId of Object.keys(DECKS)) {
      const stats = queueStats(deckId);
      const button = document.getElementById(deckId === 'en' ? 'nqLimitEn' : 'nqLimitDe');
      if (button) {
        button.innerHTML = `${DECKS[deckId].flag} ${DECKS[deckId].name}: ${stats.introduced}/${stats.limit} novas<small>${stats.reviews} revisões pendentes · ${stats.available} nova(s) liberada(s) hoje${stats.waiting > stats.available ? ` · ${stats.waiting - stats.available} aguardando` : ''}</small>`;
      }
    }

    document.querySelectorAll('.deck-card').forEach(cardEl => {
      const title = cardEl.querySelector('.deck-title')?.textContent?.toLowerCase() || '';
      const deckId = title.includes('deutsch') ? 'de' : title.includes('english') ? 'en' : null;
      if (!deckId) return;
      const old = cardEl.querySelector('.nq-deck-info');
      if (old) old.remove();
      const stats = queueStats(deckId);
      const info = document.createElement('div');
      info.className = 'nq-deck-info';
      info.innerHTML = `<b>${stats.reviews}</b> revisões · <b>${stats.introduced}/${stats.limit}</b> novas hoje${stats.available ? ` · ${stats.available} liberada(s)` : ''}`;
      const action = cardEl.querySelector('.deck-action');
      if (action) cardEl.insertBefore(info, action); else cardEl.appendChild(info);
    });
  }

  ensureQueueSettings();
  backfillIntroducedDays();
  save();
  injectStyles();

  const baseRender = render;
  render = function() {
    const result = baseRender();
    updatePanel();
    return result;
  };

  updatePanel();
})();
