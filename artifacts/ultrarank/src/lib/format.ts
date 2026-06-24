export function formatSecondsToTime(totalSeconds?: number | null): string {
  if (totalSeconds == null) return "-";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  return [
    h.toString().padStart(2, "0"),
    m.toString().padStart(2, "0"),
    s.toString().padStart(2, "0")
  ].join(":");
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function formatNumber(num?: number | null): string {
  if (num == null) return "-";
  return new Intl.NumberFormat("en-US").format(num);
}
