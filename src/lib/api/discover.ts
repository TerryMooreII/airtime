import { one } from '@/lib/api/_query'
import { resolveLocalShows } from '@/lib/api/shows'
import { supabase } from '@/lib/supabase'
import { fetchPersonCredits, fetchShowCast } from '@/lib/tvmaze'
import type { CastRailItem, DiscoverRails } from '@/types/domain'

export async function fetchDiscoverRails(): Promise<DiscoverRails> {
  const rails = await one<DiscoverRails>(supabase.rpc('discover_rails'))
  if (!rails) throw new Error('discover_rails returned nothing')
  return rails
}

/**
 * "Shares cast with <top-rated show>": the three lead cast members' other shows that exist in
 * the local catalog and are not followed yet. Cast and credits come live from TVmaze.
 */
export async function fetchSharedCastRail(
  top: { tvmaze_id: number },
  followedShowIds: ReadonlySet<number> | ReadonlyMap<number, unknown>,
  limit = 14,
): Promise<CastRailItem[]> {
  const cast = (await fetchShowCast(top.tvmaze_id)).filter((c) => !c.self).slice(0, 3)
  const creditLists = await Promise.all(cast.map((c) => fetchPersonCredits(c.personId)))
  const byShow = new Map<number, { via: string; credit: (typeof creditLists)[number][number] }>()
  creditLists.forEach((list, i) => {
    for (const credit of list) {
      if (
        credit.showTvmazeId === top.tvmaze_id ||
        !credit.showImage ||
        byShow.has(credit.showTvmazeId)
      )
        continue
      byShow.set(credit.showTvmazeId, { via: cast[i]!.name, credit })
    }
  })
  const local = await resolveLocalShows([...byShow.keys()])
  return [...byShow.entries()]
    .filter(([tvmazeId]) => local.has(tvmazeId) && !followedShowIds.has(local.get(tvmazeId)!))
    .slice(0, limit)
    .map(([tvmazeId, { via, credit }]) => ({
      id: local.get(tvmazeId)!,
      tvmaze_id: tvmazeId,
      name: credit.showName,
      image_medium: credit.showImage,
      image_original: null,
      premiered: credit.premiered,
      genres: [],
      status: credit.status,
      summary_html: null,
      network_name: null,
      rating: null,
      via,
    }))
}
