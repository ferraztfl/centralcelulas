import { NETWORK_STYLES, type NetworkId } from "@/lib/networks";
import { cn } from "@/lib/utils";

export function NetworkBadge({ networkId, name, className }: { networkId: string; name: string; className?: string }) {
  const s = NETWORK_STYLES[networkId as NetworkId];
  if (!s) return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium bg-muted", className)}>{name}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm", s.bg, className)}>
      <span className="size-1.5 rounded-full bg-white/80" />
      {name}
    </span>
  );
}
