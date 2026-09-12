(() => {
  'use strict';

  const THEME_KEY = 'recallThemeV1';
  const MODES = [
    { value: 'recognition', label: '🎧 Compreensão' },
    { value: 'production', label: '🗣 Fala' },
    { value: 'smart', label: '🧠 Misto' }
  ];

  function addStyles() {
    if (document.getElementById('recallHomeControlsStyle')) return;
    const style = document.createElement('style');
    style.id = 'recallHomeControlsStyle';
    style.textContent = `
      html[data-recall-theme="light"]{
        --bg:#f7f7fb;--surface:#fff;--surface2:#f1f0f8;--ink:#1d1d29;--muted:#77778a;--line:#e3e2ec;
      }
      html[data-recall-theme="light"] .flashcard,
      html[data-recall-theme="light"] .speed,
      html[data-recall-theme="light"] textarea,
      html[data-recall-theme="light"] input[type=search],
      html[data-recall-theme="light"] select.setting,
      html[data-recall-theme="light"] .rate,
      html[data-recall-theme="light"] .item-actions button{background:#fff;color:var(--ink)}
      html[data-recall-theme="light"] .audio.normal{background:#eef3ff;color:#25335f}
      html[data-recall-theme="light"] .audio.slow{background:#f3efff;color:#493a96}

      html[data-recall-theme="dark"]{
        --bg:#18171f;--surface:#22212b;--surface2:#2a2833;--ink:#f5f3fb;--muted:#aaa6b5;--line:#373440;
      }
      html[data-recall-theme="dark"] .flashcard,
      html[data-recall-theme="dark"] .speed,
      html[data-recall-theme="dark"] textarea,
      html[data-recall-theme="dark"] input[type=search],
      html[data-recall-theme="dark"] select.setting,
      html[data-recall-theme="dark"] .rate,
      html[data-recall-theme="dark"] .item-actions button{background:#26242f;color:var(--ink)}
      html[data-recall-theme="dark"] .audio.normal{background:#2b3040;color:#e4e9ff}
      html[data-recall-theme="dark"] .audio.slow{background:#312c43;color:#eee7ff}
      html[data-recall-theme="dark"] .deck-mode{background:#312d4f;color:#cfc6ff}

      .theme-toggle{
        width:44px;height:44px;flex:0 0 44px;border:1px solid var(--line);border-radius:14px;
        background:var(--surface);color:var(--ink);font-size:20px;display:grid;place-items:center;padding:0;
      }
      .topstats{align-items:center}
      .deck-study-label{margin-top:14px;margin-bottom:7px;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.02em}
      .deck-mode-picker{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}
      .deck-mode-option{
        min-height:42px;border:1px solid var(--line);background:var(--surface2);color:var(--muted);
        border-radius:12px;display:flex;align-items:center;justify-content:center;text-align:center;
        padding:7px 5px;font-size:10.5px;font-weight:850;line-height:1.15;user-select:none;-webkit-user-select:none;
      }
      .deck-mode-option.active{background:var(--primary);border-color:var(--primary);color:#fff}
      .deck-mode-option:active{transform:scale(.98)}
      @media(max-width:430px){.deck-mode-option{font-size:9.7px;padding:6px 3px}.theme-toggle{width:42px;height:42px;flex-basis:42px}}
    `;
    document.head.appendChild(style);
  }

  function preferredInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.recallTheme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      toggle.title = theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro';
      toggle.setAttribute('aria-label', toggle.title);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#18171f' : '#3C318C');
  }

  function ensureThemeToggle() {
    if (document.getElementById('themeToggle')) return;
    const topstats = document.querySelector('.topstats');
    if (!topstats) return;
    const button = document.createElement('button');
    button.id = 'themeToggle';
    button.className = 'theme-toggle';
    button.type = 'button';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = document.documentElement.dataset.recallTheme || 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
    topstats.prepend(button);
    applyTheme(document.documentElement.dataset.recallTheme || preferredInitialTheme());
  }

  function deckIdFromCard(card) {
    const title = card.querySelector('.deck-title')?.textContent?.trim().toLowerCase() || '';
    if (title.includes('deutsch')) return 'de';
    if (title.includes('english')) return 'en';
    return null;
  }

  function currentModeForDeck(deckId) {
    const deckSelect = document.getElementById('settingsDeck');
    const modeSelect = document.getElementById('studyMode');
    if (!deckSelect || !modeSelect) return 'smart';
    deckSelect.value = deckId;
    deckSelect.dispatchEvent(new Event('change', { bubbles: true }));
    return modeSelect.value || 'smart';
  }

  function setModeForDeck(deckId, mode) {
    const deckSelect = document.getElementById('settingsDeck');
    const modeSelect = document.getElementById('studyMode');
    if (!deckSelect || !modeSelect) return;
    deckSelect.value = deckId;
    deckSelect.dispatchEvent(new Event('change', { bubbles: true }));
    modeSelect.value = mode;
    modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function enhanceDeckCard(card) {
    if (card.querySelector('.deck-mode-picker')) return;
    const deckId = deckIdFromCard(card);
    if (!deckId) return;

    const label = document.createElement('div');
    label.className = 'deck-study-label';
    label.textContent = 'Como você quer estudar?';

    const picker = document.createElement('div');
    picker.className = 'deck-mode-picker';
    picker.dataset.deck = deckId;

    const activeMode = currentModeForDeck(deckId);
    MODES.forEach(mode => {
      const option = document.createElement('div');
      option.className = `deck-mode-option${activeMode === mode.value ? ' active' : ''}`;
      option.textContent = mode.label;
      option.dataset.mode = mode.value;
      option.setAttribute('role', 'button');
      option.setAttribute('tabindex', '0');

      const choose = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setModeForDeck(deckId, mode.value);
      };
      option.addEventListener('click', choose);
      option.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') choose(event);
      });
      picker.appendChild(option);
    });

    const action = card.querySelector('.deck-action');
    if (action) {
      card.insertBefore(label, action);
      card.insertBefore(picker, action);
    } else {
      card.append(label, picker);
    }
  }

  let scheduled = false;
  function enhanceDecks() {
    scheduled = false;
    document.querySelectorAll('.deck-card').forEach(enhanceDeckCard);
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhanceDecks);
  }

  function init() {
    addStyles();
    applyTheme(preferredInitialTheme());
    ensureThemeToggle();
    enhanceDecks();

    const grid = document.getElementById('deckGrid');
    if (grid) new MutationObserver(scheduleEnhance).observe(grid, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();