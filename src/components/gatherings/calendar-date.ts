/** All-day gatherings encode a calendar date in the UTC part of a timestamp. */
export function calendarDate(iso: Date | string): Date {
  const value = new Date(iso);
  return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function calendarInputValue(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export function calendarDayStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function calendarDayEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}
