export const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
] as const;

export const weekdayLabel = (w: number | null | undefined) =>
  w == null ? null : WEEKDAYS.find(d => d.value === w)?.label ?? null;

export const formatMeetingTime = (t: string | null | undefined) => {
  if (!t) return null;
  // expects "HH:MM:SS" or "HH:MM"
  const [h, m] = t.split(":");
  return `${h}:${m}`;
};
