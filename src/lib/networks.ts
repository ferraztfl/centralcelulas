// Client-safe helpers for network presentation.
export type NetworkId =
  | "decolar" | "start" | "connect" | "connect_up"
  | "acelere" | "impulse" | "amor_a2";

export const NETWORK_STYLES: Record<NetworkId, { bg: string; text: string; ring: string; label: string }> = {
  decolar:    { bg: "bg-net-decolar",   text: "text-net-decolar",   ring: "ring-net-decolar",   label: "Azul" },
  start:      { bg: "bg-net-start",     text: "text-net-start",     ring: "ring-net-start",     label: "Verde" },
  connect:    { bg: "bg-net-connect",   text: "text-net-connect",   ring: "ring-net-connect",   label: "Amarelo" },
  connect_up: { bg: "bg-net-connectup", text: "text-net-connectup", ring: "ring-net-connectup", label: "Marrom" },
  acelere:    { bg: "bg-net-acelere",   text: "text-net-acelere",   ring: "ring-net-acelere",   label: "Laranja" },
  impulse:    { bg: "bg-net-impulse",   text: "text-net-impulse",   ring: "ring-net-impulse",   label: "Roxo" },
  amor_a2:    { bg: "bg-net-amor",      text: "text-net-amor",      ring: "ring-net-amor",      label: "Vermelho" },
};

export const NETWORK_HEX: Record<NetworkId, string> = {
  decolar: "#2563eb", start: "#16a34a", connect: "#eab308",
  connect_up: "#7c4a1e", acelere: "#f97316", impulse: "#9333ea", amor_a2: "#dc2626",
};
