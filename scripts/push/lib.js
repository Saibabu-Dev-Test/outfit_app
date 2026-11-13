/* eslint-env node */
// Pure helpers for the push sender (tested in __tests__/pushSender.test.ts).
// Like levels: keep in step with src/config/likeLevels.ts.
'use strict';

const LIKE_LEVELS = [
  { level: 'diamond', min: 9999, label: 'Diamond' },
  { level: 'gold', min: 4999, label: 'Gold' },
  { level: 'silver', min: 1999, label: 'Silver' },
  { level: 'bronze', min: 0, label: 'Bronze' },
];

const likeLevelFor = n => {
  const x = Number.isFinite(n) ? Math.max(0, n) : 0;
  return (LIKE_LEVELS.find(l => x >= l.min) || LIKE_LEVELS[LIKE_LEVELS.length - 1]).level;
};
const levelLabel = level => (LIKE_LEVELS.find(l => l.level === level) || LIKE_LEVELS[3]).label;

// activity docs [{owner, type, actorId, actorName}] -> Map owner -> {likes, people, others[]}
const groupByOwner = items => {
  const out = new Map();
  for (const a of items) {
    if (!a || !a.owner) continue;
    if (!out.has(a.owner)) out.set(a.owner, { likes: 0, likers: new Set(), others: [] });
    const g = out.get(a.owner);
    if (a.type === 'like') {
      g.likes += 1;
      g.likers.add(a.actorId || `anon_${g.likes}`);
    } else {
      g.others.push(a);
    }
  }
  return out;
};

const OTHER_TEXT = {
  comment: n => `${n} new comment${n === 1 ? '' : 's'}`,
  follow: n => `${n} new follower${n === 1 ? '' : 's'}`,
  dislike: n => `${n} new reaction${n === 1 ? '' : 's'}`,
  mention: n => `${n} birthday mention${n === 1 ? '' : 's'}`,
  wish: n => `${n} birthday wish${n === 1 ? '' : 'es'}`,
  feedback: n => `${n} new feedback`,
  referral: n => `${n} friend${n === 1 ? '' : 's'} joined with your link`,
};

// Messages for one owner: a like summary with the coin level (+ coin flip payload) and one
// summary of everything else. Same wording as the app's local notification (src/services/likeCoins.ts).
const messagesFor = (group, likesReceived) => {
  const msgs = [];
  if (group.likes) {
    const level = likeLevelFor(likesReceived);
    const lbl = levelLabel(level);
    const people = group.likers.size;
    const who = people === 1 ? '1 person' : `${people.toLocaleString('en-IN')} people`;
    const body =
      group.likes > people
        ? `${who} gave you ${group.likes.toLocaleString('en-IN')} likes at ${lbl} coin level. Tap to flip your coins ✨`
        : `${who} liked ${group.likes === 1 ? 'your photo' : 'your photos'} at ${lbl} coin level. Tap to flip your coins ✨`;
    msgs.push({
      title: `🪙 ${lbl} coin likes!`,
      body,
      payload: JSON.stringify({ t: 'coinRain', level, count: Math.max(1, people) }),
    });
  }
  if (group.others.length) {
    const counts = {};
    group.others.forEach(a => (counts[a.type] = (counts[a.type] || 0) + 1));
    const parts = Object.keys(counts).map(t => (OTHER_TEXT[t] ? OTHER_TEXT[t](counts[t]) : `${counts[t]} new updates`));
    const single = group.others.length === 1 && group.others[0].actorName;
    msgs.push({
      title: 'Outfit',
      body: single ? `${group.others[0].actorName}: ${parts[0]}` : parts.join(' · '),
      payload: null,
    });
  }
  return msgs;
};

// FCM errors that mean the token is gone for good
const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);
const isDeadToken = code => DEAD_TOKEN_CODES.has(code);

module.exports = { LIKE_LEVELS, likeLevelFor, groupByOwner, messagesFor, isDeadToken };
