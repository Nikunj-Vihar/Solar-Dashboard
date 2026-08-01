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
