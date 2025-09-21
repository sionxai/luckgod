import { db, ref, set } from './firebase.js';
import { push } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js';

export const MAIL_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export function sanitizeMailRewards(rewards) {
  const map = {};
  if (!rewards || typeof rewards !== 'object') return map;
  ['gold', 'points', 'diamonds', 'petTickets'].forEach((key) => {
    const value = Number(rewards[key]);
    if (Number.isFinite(value) && value !== 0) {
      map[key] = Math.trunc(value);
    }
  });
  return map;
}

export function buildMailEntry(id, payload = {}) {
  const now = Date.now();
  const createdAt = typeof payload.createdAt === 'number' ? payload.createdAt : now;
  const expiresAt = typeof payload.expiresAt === 'number' ? payload.expiresAt : createdAt + MAIL_EXPIRY_MS;
  return {
    id,
    title: payload.title || '우편',
    message: payload.message || '',
    rewards: sanitizeMailRewards(payload.rewards),
    metadata: payload.metadata || {},
    type: payload.type || 'general',
    createdAt,
    expiresAt,
    read: !!payload.read
  };
}

export async function enqueueMail(uid, payload = {}) {
  if (!uid) throw new Error('uid가 필요합니다.');
  const now = Date.now();
  const mailRef = push(ref(db, `mailbox/${uid}`));
  const entry = buildMailEntry(mailRef.key, {
    ...payload,
    createdAt: payload.createdAt ?? now,
    expiresAt: payload.expiresAt ?? now + MAIL_EXPIRY_MS
  });
  await set(mailRef, {
    title: entry.title,
    message: entry.message,
    rewards: entry.rewards,
    metadata: entry.metadata,
    type: entry.type,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
    read: entry.read
  });
  return entry.id;
}
