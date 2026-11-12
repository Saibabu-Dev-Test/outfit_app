// Function planner: weddings, haldi, puja, parties... the user adds a function (name, type, date,
// optional time and city); Home shows the next one with its weather (services/weatherApi.ts) and
// what to wear, and the phone reminds the evening before (7 PM) and on the morning (8 AM).
// Kept on the phone (AsyncStorage, per user). Pure helpers are exported for tests.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '../utils/date';
import { cancelReminder, scheduleReminder } from '../native/notifications';

export type FunctionType = 'wedding' | 'haldi' | 'mehendi' | 'engagement' | 'puja' | 'birthday' | 'party' | 'office' | 'other';

export const FUNCTION_TYPES: { type: FunctionType; emoji: string; label: string }[] = [
  { type: 'wedding', emoji: '💍', label: 'Wedding' },
  { type: 'engagement', emoji: '💐', label: 'Engagement' },
  { type: 'haldi', emoji: '💛', label: 'Haldi' },
  { type: 'mehendi', emoji: '🌿', label: 'Mehendi' },
  { type: 'puja', emoji: '🪔', label: 'Puja / Vratham' },
  { type: 'birthday', emoji: '🎂', label: 'Birthday' },
  { type: 'party', emoji: '🎉', label: 'Party' },
  { type: 'office', emoji: '💼', label: 'Office event' },
  { type: 'other', emoji: '📅', label: 'Other' },
];

export interface PlannedFunction {
  id: string;
  title: string;
  type: FunctionType;
  date: string; // YYYY-MM-DD local
  time: string | null; // HH:MM local
  city: string;
  note: string;
  createdAt: number;
}

export const MAX_FUNCTIONS = 50;
const key = (uid: string) => `outfitplan:functions:${uid || 'anon'}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidDate = (s: string): boolean => {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};
export const isValidTime = (s: string): boolean => TIME_RE.test(s);

// Whole days from today (local) to the date; negative = past
export const daysUntil = (date: string, today: string = localDateKey()): number => {
  const [y, m, d] = date.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
};

export const whenText = (n: number): string => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 0 ? `${-n} days ago` : `In ${n} days`);

// Today and later, soonest first
export const upcomingFunctions = (list: PlannedFunction[], today: string = localDateKey()): PlannedFunction[] =>
  list
    .filter(f => isValidDate(f.date) && daysUntil(f.date, today) >= 0)
    .sort((a, b) => (a.date === b.date ? (a.time || '').localeCompare(b.time || '') : a.date.localeCompare(b.date)));

// Outfit ideas by function type
export const OUTFIT_TIPS: Record<FunctionType, string> = {
  wedding: 'Silk saree / lehenga or sherwani / kurta with a dupatta; rich colours like red, maroon, gold or royal blue.',
  engagement: 'Elegant pastel or jewel-tone saree / lehenga, or a bandhgala / Indo-western set.',
  haldi: 'Yellow or bright floral cotton you don’t mind staining; simple footwear.',
  mehendi: 'Green, mint or bright colours with short or tied sleeves so the henna stays clean.',
  puja: 'Traditional cotton or silk in white, yellow, orange or red; avoid black.',
  birthday: 'Something cheerful and comfortable: a bright dress, kurti or shirt in your lucky colour.',
  party: 'Smart evening wear: a dark or metallic outfit, statement accessories.',
  office: 'Smart formals or ethnic formals in neutral colours; comfortable shoes.',
  other: 'Pick something comfortable in today’s lucky colour.',
};

export const typeMeta = (t: FunctionType) => FUNCTION_TYPES.find(x => x.type === t) || FUNCTION_TYPES[FUNCTION_TYPES.length - 1];

// Reminder times: 7 PM the evening before and 8 AM on the day (only future ones)
export interface PlanReminder {
  id: number; // stable per function + slot (native alarm request code)
  at: number; // ms
  title: string;
  body: string;
}

export const reminderId = (fnId: string, slot: 0 | 1): number => {
  let h = 0;
  for (let i = 0; i < fnId.length; i++) h = (h * 31 + fnId.charCodeAt(i)) | 0;
  return 20000 + (Math.abs(h) % 40000) * 2 + slot;
};

export const remindersFor = (f: PlannedFunction, now: number = Date.now()): PlanReminder[] => {
  if (!isValidDate(f.date)) return [];
  const [y, m, d] = f.date.split('-').map(Number);
  const meta = typeMeta(f.type);
  const at = f.time ? ` at ${f.time}` : '';
  const list: PlanReminder[] = [
    {
      id: reminderId(f.id, 0),
      at: new Date(y, m - 1, d - 1, 19, 0, 0).getTime(),
      title: `${meta.emoji} ${f.title} is tomorrow`,
      body: `Get your outfit ready tonight${f.city ? ` · ${f.city}` : ''}. ${OUTFIT_TIPS[f.type]}`,
    },
    {
      id: reminderId(f.id, 1),
      at: new Date(y, m - 1, d, 8, 0, 0).getTime(),
      title: `${meta.emoji} ${f.title} today${at}`,
      body: 'Open Outfit for the weather and what to wear ✨',
    },
  ];
  return list.filter(r => r.at > now);
};

export const loadFunctions = async (uid: string): Promise<PlannedFunction[]> => {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((f: any) => f && typeof f.id === 'string' && isValidDate(f.date)) : [];
  } catch {
    return [];
  }
};

const saveAll = async (uid: string, list: PlannedFunction[]) => {
  await AsyncStorage.setItem(key(uid), JSON.stringify(list.slice(-MAX_FUNCTIONS)));
};

export const newFunctionId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const saveFunction = async (uid: string, f: PlannedFunction): Promise<PlannedFunction[]> => {
  const list = (await loadFunctions(uid)).filter(x => x.id !== f.id);
  list.push(f);
  await saveAll(uid, list);
  return list;
};

export const deleteFunction = async (uid: string, id: string): Promise<PlannedFunction[]> => {
  const list = (await loadFunctions(uid)).filter(x => x.id !== id);
  await saveAll(uid, list);
  return list;
};

// Arms the phone reminders for every upcoming function (idempotent; called on save, on Home and
// after a delete). Past ones are skipped by remindersFor. Never throws.
export const syncPlanReminders = async (list: PlannedFunction[]): Promise<void> => {
  try {
    await Promise.all(upcomingFunctions(list).flatMap(f => remindersFor(f).map(r => scheduleReminder(r.id, r.at, r.title, r.body))));
  } catch {}
};

export const cancelPlanReminders = async (f: PlannedFunction): Promise<void> => {
  await cancelReminder(reminderId(f.id, 0));
  await cancelReminder(reminderId(f.id, 1));
};
