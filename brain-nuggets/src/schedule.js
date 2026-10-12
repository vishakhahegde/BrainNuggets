// Spreads an assignment's unfinished tasks over the days left before it's due.
// Recomputed on every render, so tasks missed yesterday simply roll into today.

const DAY_MS = 24 * 60 * 60 * 1000;

export const DAILY_MINUTES = [10, 20, 30, 45, 60];

// Local calendar date as YYYY-MM-DD.
export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const parse = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

// Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` has passed.
export const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / DAY_MS);

export function dueLabel(dueDate, today = dayKey()) {
  const date = parse(dueDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const n = daysBetween(today, dueDate);
  if (n < 0) return `Was due ${date}`;
  if (n === 0) return `Due today, ${date}`;
  if (n === 1) return `Due tomorrow, ${date}`;
  return `Due ${date} · ${n} days left`;
}

// Work days run from today up to the day before the due date (or just today if it's due today or has passed).
export function planDays(tasks, dueDate, minutesPerDay, today = dayKey()) {
  const pending = tasks.filter((t) => !t.done);
  const doneToday = tasks.filter((t) => t.done && t.doneOn === today).reduce((s, t) => s + t.minutes, 0);
  const days = Math.max(1, daysBetween(today, dueDate));
  const remaining = pending.reduce((s, t) => s + t.minutes, 0);
  const capacity = Math.max(0, minutesPerDay - doneToday) + (days - 1) * minutesPerDay;

  const behind = remaining > capacity;
  // Rounded up to 5 minutes, so the hint reads naturally.
  const extraPerDay = behind ? Math.ceil((remaining - capacity) / days / 5) * 5 : 0;
  // When behind, each day's share includes the extra minutes, so the work spreads out instead of piling up on the last day.
  const budget = minutesPerDay + extraPerDay;

  const dayOf = {};
  let day = 0;
  let used = doneToday;
  for (const t of pending) {
    // Move to the next day when this task won't fit, unless it's the last day (overflow lands there).
    while (day < days - 1 && used > 0 && used + t.minutes > budget) { day += 1; used = 0; }
    dayOf[t.id] = day;
    used += t.minutes;
  }

  const todayTasks = pending.filter((t) => dayOf[t.id] === 0);
  return {
    today: todayTasks,
    todayMinutes: todayTasks.reduce((s, t) => s + t.minutes, 0),
    doneToday,
    dayOf,
    days,
    remaining,
    behind,
    extraPerDay,
  };
}
