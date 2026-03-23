import { useQuery } from "@tanstack/react-query";
import type { CDMData } from "@/lib/guardian-types";

export function useGuardianCDM() {
  return useQuery({
    queryKey: ["guardian-cdm-data"],
    queryFn: async (): Promise<CDMData> => {
      const res = await fetch("/api/guardian/cdm");
      if (!res.ok) {
        throw new Error(`CDM Guardian API returned ${res.status}`);
      }
      return res.json() as Promise<CDMData>;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}
