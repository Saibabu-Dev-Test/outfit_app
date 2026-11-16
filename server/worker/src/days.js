// Day keys ('YYYY-MM-DD') in the time zone each free quota resets in:
//   Firestore (Spark) daily quota resets at midnight US Pacific time
//   D1 daily limits reset at 00:00 UTC
//   Owner-facing "today" (new / active users, postbacks) is India time
const fmt = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const PT = fmt('America/Los_Angeles');
const IST = fmt('Asia/Kolkata');

export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const ptDay = (now = Date.now()) => PT.format(new Date(now));
export const istDay = (now = Date.now()) => IST.format(new Date(now));
