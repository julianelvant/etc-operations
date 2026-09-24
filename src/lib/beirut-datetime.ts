import { TIMEZONE } from "@/lib/schedule";

/** ISO timestamp → YYYY-MM-DD in Beirut. */
export function isoToBeirutDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso));
}

/** ISO timestamp → HH:MM (24h) in Beirut. */
export function isoToBeirutTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${hour}:${parts.minute}`;
}

/** YYYY-MM-DD + HH:MM (Beirut wall) → ISO string. */
export function beirutDateTimeToIso(date: string, time: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date or time");
  }
  const hh = String(Number(m[1])).padStart(2, "0");
  const mm = m[2];
  const local = `${date}T${hh}:${mm}`;
  const parts = local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );
  if (!parts) throw new Error("Invalid datetime");
  const [, y, mo, d, h, mi] = parts;
  let guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  for (let i = 0; i < 3; i++) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const gotParts = Object.fromEntries(
      fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const gotHour = gotParts.hour === "24" ? "00" : gotParts.hour;
    const got = `${gotParts.year}-${gotParts.month}-${gotParts.day}T${gotHour}:${gotParts.minute}`;
    if (got === local) break;
    const gotMs = Date.UTC(
      Number(gotParts.year),
      Number(gotParts.month) - 1,
      Number(gotParts.day),
      Number(gotHour),
      Number(gotParts.minute),
    );
    guess +=
      Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) -
      gotMs;
  }
  return new Date(guess).toISOString();
}
