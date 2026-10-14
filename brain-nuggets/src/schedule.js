// Splits an assignment's unfinished tasks evenly over the days left before it's due.
// Recomputed on every render, so tasks missed yesterday simply roll into today.

const DAY_MS = 24 * 60 * 60 * 1000;

export const BEHIND_TEXT = 'A bit behind. Today has a little extra to catch up.';

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

// The day an assignment was added, from its createdAt (a Firestore Timestamp or the local stand-in).
export const startDayOf = (a) => {
  const ms = a?.createdAt?.toMillis?.();
  return ms ? dayKey(ms) : dayKey();
};

// Work days run from today up to the day before the due date (or just today if it's due today or has passed).
// Today's share is the remaining work, plus anything already finished today, split evenly over those days.
// "Behind" compares what's done with an even pace from the day the assignment was added.
export function planDays(tasks, dueDate, startDay = dayKey(), today = dayKey()) {
  const sum = (list) => list.reduce((s, t) => s + t.minutes, 0);
  const pending = tasks.filter((t) => !t.done);
  const doneToday = sum(tasks.filter((t) => t.done && t.doneOn === today));
  const doneTotal = sum(tasks.filter((t) => t.done));
  const remaining = sum(pending);
  const days = Math.max(1, daysBetween(today, dueDate));
  const share = (remaining + doneToday) / days;

  const todayTasks = [];
  let used = doneToday;
  for (const t of pending) {
    if (days > 1 && used >= share) break;
    todayTasks.push(t);
    used += t.minutes;
  }

  // Even pace: by the start of today, this much should be done. Half a task of slack before calling it behind.
  const totalDays = Math.max(1, daysBetween(startDay, dueDate));
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(startDay, today)));
  const expected = (sum(tasks) * elapsed) / totalDays;
  const avgTask = tasks.length ? sum(tasks) / tasks.length : 10;
  const behind = pending.length > 0 && (daysBetween(today, dueDate) < 0 || doneTotal < expected - avgTask / 2);

  return {
    today: todayTasks,
    todayMinutes: sum(todayTasks),
    doneToday,
    days,
    remaining,
    behind,
  };
}
