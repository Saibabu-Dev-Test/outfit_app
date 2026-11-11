// Age from a 'YYYY-MM-DD' date of birth, counted on the India (IST, UTC+05:30) calendar day,
// and "Name (31)" labels for showing other users. Pure (no Firebase) so it is easy to test.
const IST_OFFSET_MS = 330 * 60 * 1000;

export const ageFromDobIST = (dob?: string | null, now: Date = new Date()): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dob || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  const ist = new Date(now.getTime() + IST_OFFSET_MS); // read with UTC getters = IST wall clock
  let age = ist.getUTCFullYear() - y;
  if (ist.getUTCMonth() < mo || (ist.getUTCMonth() === mo && ist.getUTCDate() < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
};

/** Valid stored age (denormalised number) or null */
export const cleanAge = (a: unknown): number | null =>
  typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < 130 ? a : null;

/** "Krishna Prasad (31)"; plain name when the age is unknown */
export const nameWithAge = (name: string | null | undefined, age: number | null | undefined): string => {
  const n = (name || '').trim();
  const a = cleanAge(age);
  if (a === null) return n;
  return n ? `${n} (${a})` : `(${a})`;
};

/** "Krishna Prasad (31)" from a date of birth (IST); no / bad DOB -> plain name */
export const displayNameWithAge = (
  name: string | null | undefined,
  dob?: string | null,
  now: Date = new Date(),
): string => nameWithAge(name, ageFromDobIST(dob, now));

/** True when a 'YYYY-MM-DD' DOB is a real past date giving an age of 5-120 */
export const isValidDob = (dob?: string | null, now: Date = new Date()): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dob || '').trim());
  if (!m) return false;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (dt.getUTCMonth() !== Number(m[2]) - 1 || dt.getUTCDate() !== Number(m[3])) return false;
  const a = ageFromDobIST(dob, now);
  return a !== null && a >= 5 && a <= 120;
};

// The signed-in user's DOB (set by AuthContext), so new docs can carry `userAge` beside the
// denormalised `userName` (shown to people who can't read a private profile).
let myDob: string | null = null;
export const setMyDob = (dob?: string | null) => {
  myDob = dob || null;
};
export const myAgeFields = (): { userAge?: number } => {
  const a = ageFromDobIST(myDob);
  return a === null ? {} : { userAge: a };
};
