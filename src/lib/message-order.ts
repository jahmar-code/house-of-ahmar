/** Preserve PostgreSQL's microseconds when Realtime supplies a timestamp string. */
export function timestampMicros(value: Date | string): string {
  const millis = new Date(value).getTime();
  const fraction = typeof value === "string"
    ? value.match(/\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/i)?.[1]
    : undefined;
  const remainder = fraction ? fraction.padEnd(6, "0").slice(3, 6) : "0";
  return (BigInt(millis) * BigInt(1000) + BigInt(remainder)).toString();
}

export type OrderedMessage = {
  id: string;
  createdAt: Date | string;
  createdAtMicros?: string;
};

export function messageMicros(message: OrderedMessage): bigint {
  return BigInt(message.createdAtMicros ?? timestampMicros(message.createdAt));
}

/** Same ordering as PostgreSQL ORDER BY created_at, id, including timestamp ties. */
export function compareMessages(a: OrderedMessage, b: OrderedMessage): number {
  const aTime = messageMicros(a);
  const bTime = messageMicros(b);
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}
