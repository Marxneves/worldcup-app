// Game 6:  2026-06-13T22:00Z → June 13 BRT
// Game 31: 2026-06-20T01:00Z → June 19 BRT
// Game 52: 2026-06-24T22:00Z → June 24 BRT
const BRAZIL_DAYS_BRT = ['2026-06-13', '2026-06-19', '2026-06-24']

export function useBrazilDay(): boolean {
  const devOverride = new URLSearchParams(window.location.search).get('brazilday') === '1'
  const todayBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return devOverride || BRAZIL_DAYS_BRT.includes(todayBRT)
}
