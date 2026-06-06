import { useQuery } from '@tanstack/react-query'

interface KnownMint { url: string; name?: string; degraded?: boolean }

async function fetchKnownMints(): Promise<KnownMint[]> {
  const res = await fetch('/api/mints/known')
  if (!res.ok) throw new Error('Failed to fetch known mints')
  const data = await res.json() as KnownMint[]
  return data
}

export function useKnownMints() {
  return useQuery({
    queryKey: ['mints-known'],
    queryFn: fetchKnownMints,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}
