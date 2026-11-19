import { addDays, formatMonth, monthDates, todayIso } from '@/lib/domain/dates';

export function calendarMonth(value: string | null, today = todayIso()) {
  const key =
    value && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 100
      ? value
      : today.slice(0, 7);
  const year = Number(key.slice(0, 4));
  const month0 = Number(key.slice(5)) - 1;
  const dates = monthDates(year, month0);
  const from = dates[0]!;
  const to = addDays(dates.at(-1)!, 1);
  return {
    key,
    year,
    month0,
    dates,
    from,
    to,
    today,
    label: formatMonth(year, month0),
    previous: addDays(from, -1).slice(0, 7),
    next: to.slice(0, 7),
    current: today.slice(0, 7),
  };
}
export type CalendarMonth = ReturnType<typeof calendarMonth>;
