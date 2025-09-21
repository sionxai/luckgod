import { db, ref, onValue } from './firebase.js';
import {
  subscribeToChatMessages,
  subscribeToCurrentUser,
  sendChatMessage,
  deleteAllChatMessages,
  sendSystemMessage
} from './chat.js';

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
  --chat-bg: rgba(12, 16, 26, 0.94);
  --chat-border: rgba(142, 238, 255, 0.25);
  --chat-accent: #6aa9ff;
  --chat-muted: #8ea0b8;
  --chat-system: #ffd166;
  --chat-shadow: 0 12px 32px rgba(5, 10, 18, 0.55);
  --chat-visible-height: 120px;
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

.global-chat {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(var(--nav-height) + 12px);
  margin: 0 auto;
  max-width: 720px;
  background: var(--chat-bg);
  border: 1px solid var(--chat-border);
  border-radius: 16px 16px 12px 12px;
  box-shadow: var(--chat-shadow);
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #d7e3f7;
  z-index: 1240;
  backdrop-filter: blur(18px);
}

.global-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.global-chat__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
  color: #e9f6ff;
  letter-spacing: 0.01em;
}

.global-chat__title::before {
  content: '💬';
  font-size: 16px;
  filter: drop-shadow(0 0 6px rgba(106, 169, 255, 0.45));
}

.global-chat__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.global-chat__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--chat-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(142, 238, 255, 0.18);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.global-chat__button:hover {
  color: #f0f7ff;
  border-color: rgba(142, 238, 255, 0.45);
  background: rgba(142, 238, 255, 0.1);
}

.global-chat__button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.global-chat__log {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  padding-right: 4px;
  font-size: 12px;
  line-height: 1.5;
  max-height: 56px;
}

.global-chat__log::-webkit-scrollbar {
  width: 6px;
}

.global-chat__log::-webkit-scrollbar-track {
  background: transparent;
}

.global-chat__log::-webkit-scrollbar-thumb {
  background: rgba(142, 238, 255, 0.28);
  border-radius: 999px;
}

.global-chat.is-expanded .global-chat__log {
  max-height: 168px;
}

.global-chat__message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  word-break: break-word;
}

.global-chat__message-time {
  flex: 0 0 auto;
  width: 44px;
  color: rgba(220, 233, 255, 0.55);
  font-variant-numeric: tabular-nums;
}

.global-chat__message-username {
  flex: 0 0 auto;
  font-weight: 700;
  color: var(--chat-accent);
}

.global-chat__message-text {
  flex: 1 1 auto;
  color: #dde9ff;
}

.global-chat__message[data-kind="system"] .global-chat__message-username,
.global-chat__message[data-kind="system"] .global-chat__message-text {
  color: var(--chat-system);
}

.global-chat__message[data-role="admin"] .global-chat__message-username {
  color: #ffd166;
}

.global-chat__message[data-self="true"] .global-chat__message-username {
  color: #9bc4ff;
}

.global-chat__empty {
  color: rgba(220, 233, 255, 0.5);
  font-size: 12px;
  text-align: center;
  padding: 6px 0;
}

.global-chat__form {
  display: flex;
  align-items: center;
  gap: 8px;
}

.global-chat__input {
  flex: 1 1 auto;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(142, 238, 255, 0.2);
  background: rgba(10, 16, 26, 0.75);
  color: #f2f7ff;
  font-size: 12px;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.global-chat__input:focus {
  outline: none;
  border-color: rgba(142, 238, 255, 0.45);
  background: rgba(12, 20, 32, 0.85);
}

.global-chat__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.global-chat__send {
  flex: 0 0 auto;
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: none;
  background: linear-gradient(135deg, #6aa9ff, #87d2ff);
  color: #091321;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.global-chat__send:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(106, 169, 255, 0.35);
}

.global-chat__send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

.global-chat__status,
.global-chat__cooldown {
  font-size: 11px;
  color: rgba(220, 233, 255, 0.7);
}

.global-chat__status[data-variant="warn"] {
  color: #ffb366;
}

.global-chat__status[data-variant="error"] {
  color: #ff7a7a;
}

.global-chat__status[data-variant="success"] {
  color: #6bd0ae;
}

.global-chat__cooldown {
  color: #ffb366;
}

.global-chat__footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

@media (max-width: 720px) {
  .global-chat {
    left: 12px;
    right: 12px;
    padding: 12px;
  }
}

@media (max-width: 520px) {
  .global-chat {
    left: 8px;
    right: 8px;
    border-radius: 14px 14px 10px 10px;
  }
  .global-chat__actions {
    gap: 6px;
  }
  .global-chat__button {
    height: 26px;
    padding: 0 10px;
  }
  .global-chat__log {
    max-height: 52px;
  }
  .global-chat.is-expanded .global-chat__log {
    max-height: 152px;
  }
}

body {
  padding-bottom: calc(var(--nav-height) + 12px + var(--chat-visible-height));
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
  initGlobalChat(nav);

  function initGlobalChat(navElement) {
    if (!navElement || typeof window === 'undefined' || typeof document === 'undefined') return;

    const COOLDOWN_THRESHOLD = 4;
    const COOLDOWN_MS = 20000;

    const chatState = {
      expanded: false,
      messages: [],
      user: null,
      consecutiveSelf: 0,
      lastSelfTimestamp: 0,
      cooldownUntil: 0,
      cooldownTimer: null,
      sending: false,
      unsubMessages: null,
      unsubUser: null,
      paddingRaf: null
    };

    const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const elements = (() => {
      const container = document.createElement('section');
      container.className = 'global-chat is-collapsed';

      const header = document.createElement('div');
      header.className = 'global-chat__header';

      const title = document.createElement('div');
      title.className = 'global-chat__title';
      title.textContent = '월드 채팅';

      const actions = document.createElement('div');
      actions.className = 'global-chat__actions';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'global-chat__button';
      toggle.textContent = '펼치기';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', '채팅창 펼치기');
      actions.appendChild(toggle);

      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'global-chat__button';
      clear.textContent = '전체 삭제';
      clear.hidden = true;
      actions.appendChild(clear);

      header.append(title, actions);

      const log = document.createElement('div');
      log.className = 'global-chat__log';

      const form = document.createElement('form');
      form.className = 'global-chat__form';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'global-chat__input';
      input.placeholder = '메시지를 입력하세요';
      input.maxLength = 300;
      input.autocomplete = 'off';
      form.appendChild(input);

      const send = document.createElement('button');
      send.type = 'submit';
      send.className = 'global-chat__send';
      send.textContent = '전송';
      form.appendChild(send);

      const footer = document.createElement('div');
      footer.className = 'global-chat__footer';

      const status = document.createElement('div');
      status.className = 'global-chat__status';
      status.hidden = true;

      const cooldown = document.createElement('div');
      cooldown.className = 'global-chat__cooldown';
      cooldown.hidden = true;

      footer.append(status, cooldown);

      container.append(header, log, form, footer);
      navElement.before(container);

      return {
        container,
        header,
        title,
        actions,
        toggle,
        clear,
        log,
        form,
        input,
        send,
        status,
        cooldown
      };
    })();

    function schedulePaddingSync() {
      if (chatState.paddingRaf) {
        cancelAnimationFrame(chatState.paddingRaf);
      }
      chatState.paddingRaf = requestAnimationFrame(() => {
        chatState.paddingRaf = null;
        syncBodyPadding();
      });
    }

    function syncBodyPadding() {
      if (!elements.container) return;
      const height = elements.container.offsetHeight || 0;
      const minHeight = 112;
      const value = Math.max(height, minHeight);
      document.body.style.setProperty('--chat-visible-height', `${value}px`);
    }

    function isNearBottom(element) {
      if (!element) return true;
      return (element.scrollHeight - element.scrollTop - element.clientHeight) < 12;
    }

    function formatTime(value) {
      if (typeof value !== 'number' || !isFinite(value)) return '--:--';
      try {
        return timeFormatter.format(new Date(value));
      } catch (error) {
        return '--:--';
      }
    }

    function clearStatus() {
      if (!elements.status) return;
      elements.status.textContent = '';
      elements.status.dataset.variant = '';
      elements.status.hidden = true;
    }

    function showStatus(message, variant = 'info') {
      if (!elements.status) return;
      if (!message) {
        clearStatus();
        return;
      }
      elements.status.textContent = message;
      elements.status.dataset.variant = variant;
      elements.status.hidden = false;
    }

    function renderMessages(shouldStick, previousLastId) {
      const log = elements.log;
      if (!log) return;
      log.textContent = '';
      if (!chatState.messages.length) {
        const empty = document.createElement('div');
        empty.className = 'global-chat__empty';
        empty.textContent = '아직 채팅이 없습니다.';
        log.appendChild(empty);
        return;
      }
      const fragment = document.createDocumentFragment();
      chatState.messages.forEach((message) => {
        const row = document.createElement('div');
        row.className = 'global-chat__message';
        const kind = message && message.kind === 'system' ? 'system' : 'user';
        row.dataset.kind = kind;
        if (message && message.role) {
          row.dataset.role = message.role;
        }
        const isSelf = !!(chatState.user && message && message.uid && chatState.user.uid === message.uid);
        if (isSelf) {
          row.dataset.self = 'true';
        }
        const timeSpan = document.createElement('span');
        timeSpan.className = 'global-chat__message-time';
        timeSpan.textContent = formatTime(message && message.createdAt);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'global-chat__message-username';
        nameSpan.textContent = (message && message.username) || (kind === 'system' ? '시스템' : '익명 용사');
        const textSpan = document.createElement('span');
        textSpan.className = 'global-chat__message-text';
        textSpan.textContent = (message && message.text) || '';
        row.append(timeSpan, nameSpan, textSpan);
        fragment.appendChild(row);
      });
      log.appendChild(fragment);
      const lastMessage = chatState.messages.length ? chatState.messages[chatState.messages.length - 1] : null;
      const shouldScroll = shouldStick
        || (lastMessage && chatState.user && lastMessage.uid === chatState.user.uid && lastMessage.id !== previousLastId);
      if (shouldScroll) {
        log.scrollTop = log.scrollHeight;
      }
    }

    function updateSendButtonState() {
      const { send, input } = elements;
      if (!send) return;
      if (!chatState.user) {
        send.disabled = true;
        return;
      }
      if (chatState.sending) {
        send.disabled = true;
        return;
      }
      if (chatState.cooldownUntil && Date.now() < chatState.cooldownUntil) {
        send.disabled = true;
        return;
      }
      const hasText = !!(input && input.value && input.value.trim().length);
      send.disabled = !hasText;
    }

    function stopCooldownTimer() {
      if (chatState.cooldownTimer) {
        clearInterval(chatState.cooldownTimer);
        chatState.cooldownTimer = null;
      }
    }

    function startCooldownTimer() {
      if (chatState.cooldownTimer) return;
      chatState.cooldownTimer = setInterval(() => {
        if (!chatState.cooldownUntil) {
          stopCooldownTimer();
          updateCooldownNotice();
          return;
        }
        if (Date.now() >= chatState.cooldownUntil) {
          chatState.cooldownUntil = 0;
          stopCooldownTimer();
          updateCooldownNotice();
        } else {
          updateCooldownNotice();
        }
      }, 500);
    }

    function updateCooldownNotice() {
      const { cooldown } = elements;
      if (!cooldown) return;
      if (!chatState.user) {
        cooldown.hidden = true;
        stopCooldownTimer();
        chatState.cooldownUntil = 0;
        updateSendButtonState();
        return;
      }
      if (chatState.cooldownUntil && Date.now() < chatState.cooldownUntil) {
        const remaining = Math.max(0, chatState.cooldownUntil - Date.now());
        const seconds = Math.max(1, Math.ceil(remaining / 1000));
        cooldown.textContent = `${seconds}초 뒤에 다시 보낼 수 있어요.`;
        cooldown.hidden = false;
        startCooldownTimer();
      } else {
        cooldown.hidden = true;
        chatState.cooldownUntil = 0;
        stopCooldownTimer();
      }
      updateSendButtonState();
    }

    function updateUserPresence() {
      const { input, clear } = elements;
      const user = chatState.user;
      if (input) {
        if (!user) {
          input.value = '';
          input.placeholder = '로그인 후 채팅 참여가 가능합니다.';
          input.disabled = true;
        } else {
          input.disabled = false;
          input.placeholder = `${user.username}님으로 채팅하기`;
        }
      }
      if (clear) {
        clear.hidden = !(user && user.role === 'admin');
      }
      if (!user) {
        showStatus('로그인 후 채팅을 이용할 수 있습니다.', 'info');
      } else if (elements.status && elements.status.dataset.variant === 'info' && elements.status.textContent.includes('로그인')) {
        clearStatus();
      }
      updateCooldownNotice();
      schedulePaddingSync();
    }

    function updateSelfSequence() {
      if (!Array.isArray(chatState.messages) || !chatState.user) {
        chatState.consecutiveSelf = 0;
        chatState.lastSelfTimestamp = 0;
        return;
      }
      let count = 0;
      let lastTimestamp = 0;
      for (let i = chatState.messages.length - 1; i >= 0; i -= 1) {
        const message = chatState.messages[i];
        if (!message || message.kind !== 'user') continue;
        if (message.uid === chatState.user.uid) {
          count += 1;
          if (!lastTimestamp && typeof message.createdAt === 'number') {
            lastTimestamp = message.createdAt;
          }
        } else {
          break;
        }
      }
      if (count === 0) {
        chatState.consecutiveSelf = 0;
        chatState.lastSelfTimestamp = 0;
        if (chatState.cooldownUntil) {
          chatState.cooldownUntil = 0;
          stopCooldownTimer();
        }
      } else {
        chatState.consecutiveSelf = count;
        chatState.lastSelfTimestamp = lastTimestamp;
      }
      updateCooldownNotice();
    }

    chatState.unsubMessages = subscribeToChatMessages((messages) => {
      const logEl = elements.log;
      const wasNearBottom = isNearBottom(logEl);
      const previousLastId = chatState.messages.length ? chatState.messages[chatState.messages.length - 1].id : null;
      chatState.messages = Array.isArray(messages) ? messages : [];
      renderMessages(wasNearBottom, previousLastId);
      updateSelfSequence();
      updateSendButtonState();
      schedulePaddingSync();
    });

    chatState.unsubUser = subscribeToCurrentUser((user) => {
      chatState.user = user;
      updateUserPresence();
      updateSelfSequence();
      updateSendButtonState();
    });

    elements.toggle.addEventListener('click', () => {
      chatState.expanded = !chatState.expanded;
      elements.container.classList.toggle('is-expanded', chatState.expanded);
      elements.container.classList.toggle('is-collapsed', !chatState.expanded);
      elements.toggle.setAttribute('aria-expanded', chatState.expanded ? 'true' : 'false');
      elements.toggle.setAttribute('aria-label', chatState.expanded ? '채팅창 접기' : '채팅창 펼치기');
      elements.toggle.textContent = chatState.expanded ? '접기' : '펼치기';
      schedulePaddingSync();
      if (chatState.expanded) {
        requestAnimationFrame(() => {
          const logEl = elements.log;
          if (logEl) {
            logEl.scrollTop = logEl.scrollHeight;
          }
        });
      }
    });

    elements.clear.addEventListener('click', async () => {
      if (!chatState.user || chatState.user.role !== 'admin') return;
      if (!window.confirm('정말로 전체 채팅을 삭제하시겠습니까?')) return;
      elements.clear.disabled = true;
      showStatus('채팅 로그를 삭제하는 중입니다...', 'info');
      try {
        await deleteAllChatMessages();
        await sendSystemMessage('채팅 로그가 초기화되었습니다.');
        showStatus('채팅 로그를 초기화했습니다.', 'success');
        setTimeout(() => {
          if (elements.status && elements.status.dataset.variant === 'success') {
            clearStatus();
          }
        }, 2400);
      } catch (error) {
        console.warn('Failed to clear chat log', error);
        showStatus('채팅 로그 삭제에 실패했습니다. 잠시 후 다시 시도하세요.', 'error');
      } finally {
        elements.clear.disabled = false;
        schedulePaddingSync();
      }
    });

    elements.input.addEventListener('input', () => {
      updateSendButtonState();
      if (elements.status && (elements.status.dataset.variant === 'warn' || elements.status.dataset.variant === 'error')) {
        clearStatus();
      }
    });

    elements.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (chatState.sending) return;
      if (!chatState.user) {
        showStatus('로그인 후 채팅을 이용할 수 있습니다.', 'info');
        return;
      }
      const rawValue = elements.input.value || '';
      const trimmed = rawValue.trim();
      if (!trimmed) {
        updateSendButtonState();
        return;
      }
      const now = Date.now();
      if (chatState.cooldownUntil && now < chatState.cooldownUntil) {
        updateCooldownNotice();
        showStatus('잠시 후에 다시 시도하세요.', 'warn');
        return;
      }
      if (chatState.consecutiveSelf >= COOLDOWN_THRESHOLD) {
        const lastTs = chatState.lastSelfTimestamp || now;
        if ((now - lastTs) < COOLDOWN_MS) {
          chatState.cooldownUntil = lastTs + COOLDOWN_MS;
          updateCooldownNotice();
          showStatus('연속 5회 이상은 20초 뒤에 가능합니다.', 'warn');
          return;
        }
      }
      chatState.sending = true;
      updateSendButtonState();
      try {
        const result = await sendChatMessage(rawValue);
        if (!result || result.success === false) {
          showStatus('메시지를 전송하지 못했습니다. 잠시 후 다시 시도하세요.', 'error');
        } else {
          elements.input.value = '';
          if (chatState.consecutiveSelf >= COOLDOWN_THRESHOLD) {
            chatState.lastSelfTimestamp = now;
            chatState.cooldownUntil = now + COOLDOWN_MS;
          }
          updateCooldownNotice();
          clearStatus();
        }
      } catch (error) {
        console.warn('Failed to send chat message', error);
        showStatus('메시지를 전송하지 못했습니다. 잠시 후 다시 시도하세요.', 'error');
      } finally {
        chatState.sending = false;
        updateSendButtonState();
        schedulePaddingSync();
        if (elements.input) {
          elements.input.focus();
        }
      }
    });

    window.addEventListener('resize', schedulePaddingSync);

    window.addEventListener('beforeunload', () => {
      if (chatState.unsubMessages) chatState.unsubMessages();
      if (chatState.unsubUser) chatState.unsubUser();
      stopCooldownTimer();
      if (chatState.paddingRaf) {
        cancelAnimationFrame(chatState.paddingRaf);
        chatState.paddingRaf = null;
      }
    });

    schedulePaddingSync();
  }

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
