export function formatKwh(kwh: number): string {
  if (Math.abs(kwh) >= 1000) {
    return `${(kwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} MWh`;
  }
  return `${kwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh`;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number, opts?: { showSign?: boolean }): string {
  const sign = opts?.showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** "Jul 15, 2026" for a single day, "Jul 1 – Jul 15, 2026" for a range (year dropped from the start unless it differs). */
export function formatRangeLabel(from: string, to: string): string {
  const parse = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  };
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
    });
  if (from === to) return fmt(parse(from), true);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fmt(parse(from), !sameYear)} – ${fmt(parse(to), true)}`;
}
