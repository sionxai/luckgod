import { db, ref, onValue } from './firebase.js';

const NAV_ITEMS = [
  { id: 'gacha', label: '뽑기', icon: '🎲', page: 'index', section: 'gacha', href: 'index.html' },
  { id: 'equipment', label: '장비', icon: '🛡️', page: 'index', section: 'equipment', href: 'index.html#equipment' },
  { id: 'battle', label: '전투', icon: '⚔️', page: 'battle', href: 'battle.html' },
  { id: 'shop', label: '상점', icon: '🛒', page: 'index', section: 'shop', href: 'index.html#shop' },
  { id: 'pvp', label: 'PVP', icon: '👥', page: 'pvp', href: 'pvp.html' }
];

const NAV_STYLE = `
:root {
  --nav-height: 64px;
  --nav-bg: rgba(12, 16, 26, 0.92);
  --nav-border: rgba(142, 238, 255, 0.2);
  --nav-accent: #6aa9ff;
  --nav-muted: #aeb7c6;
}

.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--nav-height);
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--nav-bg);
  border-top: 1px solid var(--nav-border);
  z-index: 1200;
  backdrop-filter: blur(12px);
}

.bottom-nav__button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 8px 6px;
  background: none;
  border: none;
  color: var(--nav-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;
}

.bottom-nav__button .nav-icon {
  font-size: 20px;
  line-height: 1;
}

.bottom-nav__button.active {
  color: var(--nav-accent);
}

.bottom-nav__button.active .nav-icon {
  transform: translateY(-2px);
}

.bottom-nav__button.season-active {
  color: var(--nav-accent);
  animation: navPulse 1.4s ease-in-out infinite;
}

.bottom-nav__button.season-active .nav-icon {
  animation: navGlow 1.4s ease-in-out infinite;
}

@keyframes navPulse {
  0% { color: var(--nav-accent); }
  50% { color: #ffffff; }
  100% { color: var(--nav-accent); }
}

@keyframes navGlow {
  0% { transform: translateY(-2px) scale(1); text-shadow: 0 0 0 rgba(106,169,255,0); }
  50% { transform: translateY(-3px) scale(1.05); text-shadow: 0 0 8px rgba(106,169,255,0.65); }
  100% { transform: translateY(-2px) scale(1); text-shadow: 0 0 0 rgba(106,169,255,0); }
}

body {
  padding-bottom: calc(var(--nav-height) + 12px);
}

body[data-page="index"][data-active-section] [data-section] {
  display: none;
}
body[data-page="index"][data-active-section="gacha"] [data-section="gacha"],
body[data-page="index"][data-active-section="equipment"] [data-section="equipment"],
body[data-page="index"][data-active-section="shop"] [data-section="shop"] {
  display: block;
}
#battleRedirectPanel {
  display: none !important;
}
`;

(function initNavigation() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body) return;

  const page = body.dataset.page || 'index';
  if (!document.getElementById('global-bottom-nav-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'global-bottom-nav-styles';
    styleEl.textContent = NAV_STYLE;
    document.head.appendChild(styleEl);
  }

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  const buttons = [];
  let pvpButton = null;

  NAV_ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bottom-nav__button';
    btn.dataset.navId = item.id;
    if (item.section) btn.dataset.targetSection = item.section;
    if (item.page) btn.dataset.page = item.page;
    btn.dataset.href = item.href;
    btn.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>`;
    nav.appendChild(btn);
    buttons.push(btn);
    if (item.id === 'pvp') {
      pvpButton = btn;
    }
  });

  document.body.appendChild(nav);

  function setActiveNav(id) {
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.navId === id);
    });
    body.dataset.activeNav = id;
  }

  function setPvpSeasonActive(active) {
    if (!pvpButton) return;
    pvpButton.classList.toggle('season-active', !!active);
  }

  function setActiveSection(section, scroll = true) {
    if (!section) return;
    body.dataset.activeSection = section;
    if (scroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setActiveNav(section);
    if (page === 'index' && window.history && window.history.replaceState) {
      const newHash = `#${section}`;
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash);
      }
    }
  }

  const defaultSection = body.dataset.activeSection || body.dataset.defaultSection;
  if (page === 'index') {
    const hashSection = (window.location.hash || '').replace('#', '');
    const validSections = ['gacha', 'equipment', 'shop'];
    const initial = validSections.includes(hashSection) ? hashSection : (defaultSection || 'gacha');
    setActiveSection(initial, false);
  } else {
    const activeNav = NAV_ITEMS.find((item) => item.page === page)?.id || page;
    setActiveNav(activeNav);
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const targetPage = btn.dataset.page;
      const targetSection = btn.dataset.targetSection;
      const href = btn.dataset.href;
      if (targetPage === page && targetSection) {
        event.preventDefault();
        setActiveSection(targetSection);
        return;
      }
      if (href) {
        event.preventDefault();
        if (window.location.pathname.endsWith(href)) {
          if (targetSection) {
            setActiveSection(targetSection);
          }
        } else {
          window.location.href = href;
        }
      }
    });
  });

  const statsDetails = document.getElementById('statsDetails');
  if (statsDetails && window.matchMedia('(min-width: 1024px)').matches) {
    statsDetails.open = true;
  }

  try {
    const seasonRef = ref(db, 'pvpSeason');
    onValue(seasonRef, (snapshot) => {
      const season = snapshot.exists() ? snapshot.val() : {};
      const isActive = season && season.status === 'active';
      setPvpSeasonActive(isActive);
    }, (error) => {
      console.warn('PVP season state unavailable', error);
    });
  } catch (error) {
    console.warn('Failed to subscribe to PVP season state', error);
  }
})();
