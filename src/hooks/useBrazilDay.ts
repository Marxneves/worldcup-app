import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

interface Game {
  team1: string
  team2: string
  matchDate: string
}

export function useBrazilDay(): boolean {
  const devOverride = new URLSearchParams(window.location.search).get('brazilday') === '1'

  const { data: games } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const { data } = await api.get('/games')
      return (data.games ?? data) as Game[]
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!localStorage.getItem('token'),
  })

  const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const hasBrazilToday = (games ?? []).some(g => {
    const gameDayBRT = new Date(new Date(g.matchDate).getTime() - 3 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    return gameDayBRT === todayBRT && (g.team1 === 'Brasil' || g.team2 === 'Brasil')
  })

  return devOverride || hasBrazilToday
}
