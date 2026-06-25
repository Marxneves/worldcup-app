import { useState, useMemo } from 'react'
import { Game, Prediction } from '../types'
import FlagImage, { TEAM_ABBR } from './FlagImage'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TeamStat {
  team: string
  played: number
  wins: number
  draws: number
  losses: number
  gf: number
  ga: number
  gd: number
  points: number
}

// Slot de time no bracket (1º/2º de grupo, ou melhor 3º de grupos elegíveis)
type KnockoutSlot =
  | { kind: 'ranked'; pos: number; group: string }
  | { kind: 'third'; groups: string[] }

interface R32Game {
  matchId: number
  slot1: KnockoutSlot
  slot2: KnockoutSlot
  r16Id: number
}

interface R16Game {
  matchId: number
  r32Id1: number
  r32Id2: number
  qfId: number
}

// ─── Bracket oficial Copa 2026 (baseado no sorteio FIFA de dez/2024) ──────────

const R32_BRACKET: R32Game[] = [
  { matchId: 73, slot1: { kind: 'ranked', pos: 2, group: 'A' }, slot2: { kind: 'ranked', pos: 2, group: 'B' }, r16Id: 90 },
  { matchId: 74, slot1: { kind: 'ranked', pos: 1, group: 'E' }, slot2: { kind: 'third', groups: ['A','B','C','D','F'] }, r16Id: 89 },
  { matchId: 75, slot1: { kind: 'ranked', pos: 1, group: 'F' }, slot2: { kind: 'ranked', pos: 2, group: 'C' }, r16Id: 90 },
  { matchId: 76, slot1: { kind: 'ranked', pos: 1, group: 'C' }, slot2: { kind: 'ranked', pos: 2, group: 'F' }, r16Id: 91 },
  { matchId: 77, slot1: { kind: 'ranked', pos: 1, group: 'I' }, slot2: { kind: 'third', groups: ['C','D','F','G','H'] }, r16Id: 89 },
  { matchId: 78, slot1: { kind: 'ranked', pos: 2, group: 'E' }, slot2: { kind: 'ranked', pos: 2, group: 'I' }, r16Id: 91 },
  { matchId: 79, slot1: { kind: 'ranked', pos: 1, group: 'A' }, slot2: { kind: 'third', groups: ['C','E','F','H','I'] }, r16Id: 92 },
  { matchId: 80, slot1: { kind: 'ranked', pos: 1, group: 'L' }, slot2: { kind: 'third', groups: ['E','H','I','J','K'] }, r16Id: 92 },
  { matchId: 81, slot1: { kind: 'ranked', pos: 1, group: 'D' }, slot2: { kind: 'third', groups: ['B','C','G','I','J'] }, r16Id: 94 },
  { matchId: 82, slot1: { kind: 'ranked', pos: 1, group: 'G' }, slot2: { kind: 'third', groups: ['A','H','I','J','K'] }, r16Id: 94 },
  { matchId: 83, slot1: { kind: 'ranked', pos: 2, group: 'K' }, slot2: { kind: 'ranked', pos: 2, group: 'L' }, r16Id: 93 },
  { matchId: 84, slot1: { kind: 'ranked', pos: 1, group: 'H' }, slot2: { kind: 'ranked', pos: 2, group: 'J' }, r16Id: 93 },
  { matchId: 85, slot1: { kind: 'ranked', pos: 1, group: 'B' }, slot2: { kind: 'third', groups: ['E','F','G','I','J'] }, r16Id: 96 },
  { matchId: 86, slot1: { kind: 'ranked', pos: 1, group: 'J' }, slot2: { kind: 'ranked', pos: 2, group: 'H' }, r16Id: 95 },
  { matchId: 87, slot1: { kind: 'ranked', pos: 1, group: 'K' }, slot2: { kind: 'third', groups: ['D','E','I','J','L'] }, r16Id: 96 },
  { matchId: 88, slot1: { kind: 'ranked', pos: 2, group: 'D' }, slot2: { kind: 'ranked', pos: 2, group: 'G' }, r16Id: 95 },
]

const R16_BRACKET: R16Game[] = [
  { matchId: 89, r32Id1: 74, r32Id2: 77, qfId: 97 },
  { matchId: 90, r32Id1: 73, r32Id2: 75, qfId: 97 },
  { matchId: 91, r32Id1: 76, r32Id2: 78, qfId: 99 },
  { matchId: 92, r32Id1: 79, r32Id2: 80, qfId: 99 },
  { matchId: 93, r32Id1: 83, r32Id2: 84, qfId: 98 },
  { matchId: 94, r32Id1: 81, r32Id2: 82, qfId: 98 },
  { matchId: 95, r32Id1: 86, r32Id2: 88, qfId: 100 },
  { matchId: 96, r32Id1: 85, r32Id2: 87, qfId: 100 },
]

const QF_BRACKET = [
  { matchId: 97, r16Id1: 89, r16Id2: 90, sfId: 101 },
  { matchId: 98, r16Id1: 93, r16Id2: 94, sfId: 101 },
  { matchId: 99, r16Id1: 91, r16Id2: 92, sfId: 102 },
  { matchId: 100, r16Id1: 95, r16Id2: 96, sfId: 102 },
]

// ─── Cálculo de classificação ─────────────────────────────────────────────────

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function computeGroupStandings(games: Game[]): Map<string, TeamStat[]> {
  const result = new Map<string, TeamStat[]>()

  for (const group of GROUPS) {
    const groupGames = games.filter(g => g.group === group)
    const teamsInGroup = new Map<string, TeamStat>()

    for (const g of groupGames) {
      for (const team of [g.team1, g.team2]) {
        if (!teamsInGroup.has(team)) {
          teamsInGroup.set(team, { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 })
        }
      }

      if (g.score1 === null || g.score2 === null) continue

      const s1 = g.score1 as number
      const s2 = g.score2 as number
      const t1 = teamsInGroup.get(g.team1)!
      const t2 = teamsInGroup.get(g.team2)!

      t1.played++; t2.played++
      t1.gf += s1; t1.ga += s2; t1.gd += s1 - s2
      t2.gf += s2; t2.ga += s1; t2.gd += s2 - s1

      if (s1 > s2) {
        t1.wins++; t1.points += 3
        t2.losses++
      } else if (s1 === s2) {
        t1.draws++; t1.points += 1
        t2.draws++; t2.points += 1
      } else {
        t2.wins++; t2.points += 3
        t1.losses++
      }
    }

    const sorted = [...teamsInGroup.values()].sort((a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
    )
    result.set(group, sorted)
  }

  return result
}

function computeThirdPlaceRanking(standings: Map<string, TeamStat[]>): (TeamStat & { group: string })[] {
  const thirds: (TeamStat & { group: string })[] = []
  for (const [group, teams] of standings) {
    if (teams.length >= 3) thirds.push({ ...teams[2], group })
  }
  return thirds.sort((a, b) =>
    b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
  )
}

// Resolve qual time ocupa um slot do bracket baseado na classificação real
function resolveSlot(
  slot: KnockoutSlot,
  standings: Map<string, TeamStat[]>,
  top8thirds: Set<string>
): { team: string | null; label: string } {
  if (slot.kind === 'ranked') {
    const group = standings.get(slot.group) ?? []
    const team = group[slot.pos - 1]
    const label = `${slot.pos}º ${slot.group}`
    return { team: team?.team ?? null, label }
  }

  // slot de 3º — encontra o melhor 3º elegível que classificou no top 8
  const eligible = slot.groups
  const qualifiedEligible = eligible.filter(g => {
    const third = standings.get(g)?.[2]
    return third && top8thirds.has(third.team)
  })

  if (qualifiedEligible.length === 1) {
    const team = standings.get(qualifiedEligible[0])?.[2]
    return { team: team?.team ?? null, label: `3º ${qualifiedEligible[0]}` }
  }

  const label = `Mel. 3º (${eligible.join('/')})`
  return { team: null, label }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TeamCell({ team, label }: { team: string | null; label: string }) {
  if (!team) {
    return (
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{label}</span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>
      <FlagImage team={team} size={14} />
      {TEAM_ABBR[team] ?? team}
    </span>
  )
}

function GroupTable({ group, teams, onClick }: { group: string; teams: TeamStat[]; onClick: () => void }) {
  const groupFinished = teams.every(t => t.played === 3)

  return (
    <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, overflow: 'hidden' }}>
      <button
        onClick={onClick}
        style={{ width: '100%', backgroundColor: '#F5EDD0', padding: '6px 10px', borderBottom: '1px solid #D9CBAD', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', border: 'none' }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1 }}>
          Grupo {group}
          {groupFinished && (
            <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Encerrado
            </span>
          )}
        </span>
        <span style={{ fontSize: 10, color: '#295A71', fontWeight: 700 }}>Jogos ▸</span>
      </button>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #D9CBAD' }}>
            <th style={{ width: 16, padding: '4px 6px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>#</th>
            <th style={{ padding: '4px 4px 4px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'left' }}>Time</th>
            <th style={{ width: 22, padding: '4px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>J</th>
            <th style={{ width: 22, padding: '4px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>Pts</th>
            <th style={{ width: 26, padding: '4px 6px 4px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>SG</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, idx) => {
            const isClassified = idx < 2
            const isThird = idx === 2
            const borderLeft = isClassified
              ? '3px solid #00FEA8'
              : isThird
              ? '3px solid #FFD100'
              : '3px solid #e63946'

            return (
              <tr
                key={t.team}
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid #F0E8D5',
                  borderLeft,
                }}
              >
                <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                  {idx + 1}
                </td>
                <td style={{ padding: '5px 4px 5px 2px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FlagImage team={t.team} size={13} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a' }}>
                      {TEAM_ABBR[t.team] ?? t.team}
                    </span>
                  </span>
                </td>
                <td style={{ padding: '5px 2px', textAlign: 'center', fontSize: 11, color: '#64748b' }}>{t.played}</td>
                <td style={{ padding: '5px 2px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#1a1a1a' }}>{t.points}</td>
                <td style={{ padding: '5px 6px 5px 2px', textAlign: 'center', fontSize: 11, color: t.gd > 0 ? '#22c55e' : t.gd < 0 ? '#e63946' : '#64748b', fontWeight: 600 }}>
                  {t.gd > 0 ? `+${t.gd}` : t.gd}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function GroupGamesModal({ group, games, onClose }: { group: string; games: Game[]; onClose: () => void }) {
  const groupGames = games.filter(g => g.group === group).sort((a, b) => a.number - b.number)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: '#F5EDD0', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 40px', maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1 }}>
            Grupo {group} — Jogos
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#64748b', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groupGames.map(game => {
            const hasResult = game.score1 !== null
            return (
              <div key={game.id} style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, padding: '8px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                  J{game.number} · {new Date(game.matchDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} · {new Date(game.matchDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{TEAM_ABBR[game.team1] ?? game.team1}</span>
                    <FlagImage team={game.team1} size={16} />
                  </div>
                  <div style={{ minWidth: 52, textAlign: 'center' }}>
                    {hasResult ? (
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#295A71', fontVariantNumeric: 'tabular-nums' }}>
                        {game.score1} × {game.score2}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#D9CBAD' }}>× </span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FlagImage team={game.team2} size={16} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{TEAM_ABBR[game.team2] ?? game.team2}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatKnockoutDate(date: Date): string {
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
  const hour = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo', hour12: false })
  return `${day} · ${hour}`
}

function R32MatchCard({
  game,
  standings,
  top8thirds,
  matchDate,
}: {
  game: R32Game
  standings: Map<string, TeamStat[]>
  top8thirds: Set<string>
  matchDate?: Date
}) {
  const t1 = resolveSlot(game.slot1, standings, top8thirds)
  const t2 = resolveSlot(game.slot2, standings, top8thirds)

  return (
    <div style={{
      backgroundColor: '#FFFDF5',
      border: '1px solid #D9CBAD',
      borderRadius: 0,
      padding: '8px 10px',
    }}>
      {matchDate && (
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
          J{game.matchId} · {formatKnockoutDate(matchDate)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
        {!matchDate && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', minWidth: 20 }}>
            J{game.matchId}
          </span>
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <TeamCell team={t1.team} label={t1.label} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D9CBAD', paddingLeft: 6, paddingRight: 6 }}>×</span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          <TeamCell team={t2.team} label={t2.label} />
        </div>
      </div>
    </div>
  )
}

function R16MatchCard({ game, team1, team2, matchDate }: {
  game: R16Game
  team1?: string
  team2?: string
  matchDate?: Date
}) {
  const t1Real = team1 && !team1.startsWith('Venc.')
  const t2Real = team2 && !team2.startsWith('Venc.')

  return (
    <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, padding: '8px 10px' }}>
      {matchDate && (
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
          J{game.matchId} · {formatKnockoutDate(matchDate)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
        {!matchDate && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', minWidth: 20 }}>J{game.matchId}</span>}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          {t1Real
            ? <TeamCell team={team1!} label={team1!} />
            : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Venc. J{game.r32Id1}</span>
          }
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D9CBAD', paddingLeft: 6, paddingRight: 6 }}>×</span>
        <div style={{ flex: 1 }}>
          {t2Real
            ? <TeamCell team={team2!} label={team2!} />
            : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Venc. J{game.r32Id2}</span>
          }
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ label, count, expanded, onToggle }: {
  label: string; count?: number; expanded: boolean; onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '10px 0',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
        {count !== undefined && (
          <span style={{ marginLeft: 6, color: '#FFD100', fontWeight: 700 }}>({count})</span>
        )}
      </span>
      <span style={{ fontSize: 16, color: '#FFD100', lineHeight: 1 }}>{expanded ? '▾' : '▸'}</span>
    </button>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface GamesTabProps {
  gamesData: Game[]
  isAdmin?: boolean
  myPredictions: Map<string, Prediction>
  onSaveResult: (gameNumber: number, score1: number, score2: number) => Promise<void>
}

export default function GamesTab({ gamesData, isAdmin, myPredictions, onSaveResult }: GamesTabProps) {
  const [r32Expanded, setR32Expanded] = useState(true)
  const [r16Expanded, setR16Expanded] = useState(false)
  const [qfExpanded, setQfExpanded] = useState(false)
  const [sfExpanded, setSfExpanded] = useState(false)
  const [tpExpanded, setTpExpanded] = useState(false)
  const [finExpanded, setFinExpanded] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [adminExpanded, setAdminExpanded] = useState(false)
  const [adminEditing, setAdminEditing] = useState<number | null>(null)
  const [editScore1, setEditScore1] = useState('')
  const [editScore2, setEditScore2] = useState('')
  const [saving, setSaving] = useState(false)

  const standings = useMemo(() => computeGroupStandings(gamesData), [gamesData])

  const thirdPlaceRanking = useMemo(() => computeThirdPlaceRanking(standings), [standings])

  const knockoutGames = useMemo(() => {
    const map = new Map<number, Game>()
    for (const g of gamesData) {
      if (g.number >= 73) map.set(g.number, g)
    }
    return map
  }, [gamesData])

  const top8thirds = useMemo<Set<string>>(
    () => new Set(thirdPlaceRanking.slice(0, 8).map(t => t.team)),
    [thirdPlaceRanking]
  )

  const finishedGames = gamesData.filter(g => g.score1 !== null)
  const upcomingGames = gamesData.filter(g => g.score1 === null)

  async function handleAdminSave(gameNumber: number) {
    if (editScore1 === '' || editScore2 === '') return
    setSaving(true)
    try {
      await onSaveResult(gameNumber, Number(editScore1), Number(editScore2))
      setAdminEditing(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Classificação por grupos ── */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ padding: '10px 0 8px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1 }}>
            Classificação por grupo
          </span>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          {[
            { color: '#00FEA8', label: 'Classificado (16 avos)' },
            { color: '#FFD100', label: 'Pode classificar (3º)' },
            { color: '#e63946', label: 'Eliminado' },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>

        {/* Grid de grupos — 2 colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {GROUPS.map(group => (
            <GroupTable key={group} group={group} teams={standings.get(group) ?? []} onClick={() => setSelectedGroup(group)} />
          ))}
        </div>
      </div>

      {selectedGroup && (
        <GroupGamesModal group={selectedGroup} games={gamesData} onClose={() => setSelectedGroup(null)} />
      )}

      {/* ── Ranking dos 3ºs colocados ── */}
      <div style={{ marginTop: 16, marginBottom: 4 }}>
        <div style={{ padding: '6px 0 8px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#295A71', textTransform: 'uppercase', letterSpacing: 1 }}>
            Melhores 3ºs colocados
          </span>
          <span style={{ marginLeft: 6, fontSize: 10, color: '#64748b', fontWeight: 600 }}>
            — top 8 se classificam
          </span>
        </div>
        <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', borderRadius: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #D9CBAD', backgroundColor: '#F5EDD0' }}>
                <th style={{ width: 24, padding: '5px 6px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>#</th>
                <th style={{ padding: '5px 4px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'left' }}>Time</th>
                <th style={{ width: 24, padding: '5px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>Grp</th>
                <th style={{ width: 28, padding: '5px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>J</th>
                <th style={{ width: 28, padding: '5px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>Pts</th>
                <th style={{ width: 32, padding: '5px 6px 5px 2px', fontSize: 9, color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>SG</th>
              </tr>
            </thead>
            <tbody>
              {thirdPlaceRanking.map((t, idx) => {
                const qualifying = idx < 8
                return (
                  <tr
                    key={t.team}
                    style={{
                      borderTop: idx === 0 ? 'none' : '1px solid #F0E8D5',
                      borderLeft: qualifying ? '3px solid #FFD100' : '3px solid #e63946',
                      backgroundColor: qualifying && idx < 8 ? 'rgba(255,209,0,0.04)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: qualifying ? '#B8960A' : '#94a3b8' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '5px 4px 5px 2px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FlagImage team={t.team} size={13} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a' }}>
                          {TEAM_ABBR[t.team] ?? t.team}
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: '5px 2px', textAlign: 'center', fontSize: 11, color: '#64748b', fontWeight: 600 }}>{t.group}</td>
                    <td style={{ padding: '5px 2px', textAlign: 'center', fontSize: 11, color: '#64748b' }}>{t.played}</td>
                    <td style={{ padding: '5px 2px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#1a1a1a' }}>{t.points}</td>
                    <td style={{ padding: '5px 6px 5px 2px', textAlign: 'center', fontSize: 11, color: t.gd > 0 ? '#22c55e' : t.gd < 0 ? '#e63946' : '#64748b', fontWeight: 600 }}>
                      {t.gd > 0 ? `+${t.gd}` : t.gd}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 16 Avos de Final ── */}
      <div style={{ marginTop: 16, borderTop: '1px solid #D9CBAD', paddingTop: 0 }}>
        <SectionHeader
          label="16 Avos de Final"
          count={16}
          expanded={r32Expanded}
          onToggle={() => setR32Expanded(v => !v)}
        />
        {r32Expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {[...R32_BRACKET].sort((a, b) => {
              const da = knockoutGames.get(a.matchId)?.matchDate
              const db = knockoutGames.get(b.matchId)?.matchDate
              if (!da) return 1
              if (!db) return -1
              return new Date(da).getTime() - new Date(db).getTime()
            }).map(game => (
              <R32MatchCard key={game.matchId} game={game} standings={standings} top8thirds={top8thirds} matchDate={knockoutGames.get(game.matchId) ? new Date(knockoutGames.get(game.matchId)!.matchDate) : undefined} />
            ))}
          </div>
        )}
      </div>

      {/* ── Oitavas de Final ── */}
      <div style={{ borderTop: '1px solid #D9CBAD', paddingTop: 0 }}>
        <SectionHeader
          label="Oitavas de Final"
          count={8}
          expanded={r16Expanded}
          onToggle={() => setR16Expanded(v => !v)}
        />
        {r16Expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {[...R16_BRACKET].sort((a, b) => {
              const da = knockoutGames.get(a.matchId)?.matchDate
              const db = knockoutGames.get(b.matchId)?.matchDate
              if (!da) return 1
              if (!db) return -1
              return new Date(da).getTime() - new Date(db).getTime()
            }).map(game => {
              const dbGame = knockoutGames.get(game.matchId)
              return (
                <R16MatchCard
                  key={game.matchId}
                  game={game}
                  team1={dbGame?.team1}
                  team2={dbGame?.team2}
                  matchDate={dbGame ? new Date(dbGame.matchDate) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ── Quartas de Final ── */}
      <div style={{ borderTop: '1px solid #D9CBAD', paddingTop: 0 }}>
        <SectionHeader label="Quartas de Final" count={4} expanded={qfExpanded} onToggle={() => setQfExpanded(v => !v)} />
        {qfExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {QF_BRACKET.map(q => {
              const dbGame = knockoutGames.get(q.matchId)
              const matchDate = dbGame ? new Date(dbGame.matchDate) : undefined
              const t1Real = dbGame?.team1 && !dbGame.team1.startsWith('Venc.')
              const t2Real = dbGame?.team2 && !dbGame.team2.startsWith('Venc.')
              return (
                <div key={q.matchId} style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', padding: '8px 10px' }}>
                  {matchDate && <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>J{q.matchId} · {formatKnockoutDate(matchDate)}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!matchDate && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', minWidth: 20 }}>J{q.matchId}</span>}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      {t1Real ? <TeamCell team={dbGame!.team1} label={dbGame!.team1} /> : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Venc. J{q.r16Id1}</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D9CBAD', paddingLeft: 6, paddingRight: 6 }}>×</span>
                    <div style={{ flex: 1 }}>
                      {t2Real ? <TeamCell team={dbGame!.team2} label={dbGame!.team2} /> : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Venc. J{q.r16Id2}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Semifinais ── */}
      <div style={{ borderTop: '1px solid #D9CBAD', paddingTop: 0 }}>
        <SectionHeader label="Semifinais" count={2} expanded={sfExpanded} onToggle={() => setSfExpanded(v => !v)} />
        {sfExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            {[{ matchId: 101, q1: 97, q2: 98 }, { matchId: 102, q1: 99, q2: 100 }].map(s => {
              const dbGame = knockoutGames.get(s.matchId)
              const matchDate = dbGame ? new Date(dbGame.matchDate) : undefined
              const t1Real = dbGame?.team1 && !dbGame.team1.startsWith('Venc.')
              const t2Real = dbGame?.team2 && !dbGame.team2.startsWith('Venc.')
              return (
                <div key={s.matchId} style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', padding: '8px 10px' }}>
                  {matchDate && <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>J{s.matchId} · {formatKnockoutDate(matchDate)}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!matchDate && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', minWidth: 20 }}>J{s.matchId}</span>}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      {t1Real ? <TeamCell team={dbGame!.team1} label={dbGame!.team1} /> : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Venc. J{s.q1}</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D9CBAD', paddingLeft: 6, paddingRight: 6 }}>×</span>
                    <div style={{ flex: 1 }}>
                      {t2Real ? <TeamCell team={dbGame!.team2} label={dbGame!.team2} /> : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Venc. J{s.q2}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 3º Lugar ── */}
      {(() => {
        const dbGame = knockoutGames.get(103)
        const matchDate = dbGame ? new Date(dbGame.matchDate) : undefined
        const t1Real = dbGame?.team1 && !dbGame.team1.startsWith('Perd.')
        const t2Real = dbGame?.team2 && !dbGame.team2.startsWith('Perd.')
        return (
          <div style={{ borderTop: '1px solid #D9CBAD', paddingTop: 0 }}>
            <SectionHeader label="3º Lugar" count={1} expanded={tpExpanded} onToggle={() => setTpExpanded(v => !v)} />
            {tpExpanded && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', padding: '8px 10px' }}>
                  {matchDate && <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>J103 · {formatKnockoutDate(matchDate)}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!matchDate && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', minWidth: 20 }}>J103</span>}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      {t1Real ? <TeamCell team={dbGame!.team1} label={dbGame!.team1} /> : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Perd. J101</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D9CBAD', paddingLeft: 6, paddingRight: 6 }}>×</span>
                    <div style={{ flex: 1 }}>
                      {t2Real ? <TeamCell team={dbGame!.team2} label={dbGame!.team2} /> : <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Perd. J102</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Final ── */}
      {(() => {
        const dbGame = knockoutGames.get(104)
        const matchDate = dbGame ? new Date(dbGame.matchDate) : undefined
        const t1Real = dbGame?.team1 && !dbGame.team1.startsWith('Venc.')
        const t2Real = dbGame?.team2 && !dbGame.team2.startsWith('Venc.')
        return (
          <div style={{ borderTop: '1px solid #D9CBAD', paddingTop: 0 }}>
            <SectionHeader label="Final" count={1} expanded={finExpanded} onToggle={() => setFinExpanded(v => !v)} />
            {finExpanded && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ backgroundColor: '#FFFDF5', border: '2px solid #FFD100', padding: '10px 10px' }}>
                  {matchDate && <div style={{ fontSize: 9, fontWeight: 800, color: '#B8960A', marginBottom: 4 }}>J104 · FINAL · {formatKnockoutDate(matchDate)}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!matchDate && <span style={{ fontSize: 9, fontWeight: 800, color: '#B8960A', minWidth: 20 }}>J104</span>}
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                      {t1Real ? <TeamCell team={dbGame!.team1} label={dbGame!.team1} /> : <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 700 }}>Venc. J101</span>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#FFD100', paddingLeft: 6, paddingRight: 6 }}>×</span>
                    <div style={{ flex: 1 }}>
                      {t2Real ? <TeamCell team={dbGame!.team2} label={dbGame!.team2} /> : <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 700 }}>Venc. J102</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Editar resultados (admin) ── */}
      {isAdmin && (
        <div style={{ borderTop: '1px solid #D9CBAD', paddingTop: 0, marginTop: 0 }}>
          <SectionHeader
            label="Editar resultados"
            count={finishedGames.length + upcomingGames.filter(g => new Date(g.matchDate) <= new Date()).length}
            expanded={adminExpanded}
            onToggle={() => setAdminExpanded(v => !v)}
          />
          {adminExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {[...finishedGames, ...upcomingGames.filter(g => new Date(g.matchDate) <= new Date())]
                .sort((a, b) => a.number - b.number)
                .map(game => {
                  const isEditing = adminEditing === game.number
                  const pred = myPredictions.get(game.id)
                  return (
                    <div key={game.id} style={{ backgroundColor: '#FFFDF5', border: '1px solid #D9CBAD', padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>J{game.number} Grp {game.group}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{TEAM_ABBR[game.team1] ?? game.team1}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: game.score1 !== null ? '#295A71' : '#D9CBAD' }}>
                            {game.score1 !== null ? `${game.score1}×${game.score2}` : '-'}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{TEAM_ABBR[game.team2] ?? game.team2}</span>
                        </div>
                        {!isEditing && (
                          <button
                            onClick={() => {
                              setAdminEditing(game.number)
                              setEditScore1(game.score1 !== null ? String(game.score1) : '')
                              setEditScore2(game.score2 !== null ? String(game.score2) : '')
                            }}
                            style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            editar
                          </button>
                        )}
                      </div>
                      {pred && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: 'center' }}>
                          Meu palpite: {pred.score1} × {pred.score2}
                        </div>
                      )}
                      {isEditing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0E8D5' }}>
                          <input
                            type="number" min="0"
                            value={editScore1}
                            onChange={e => setEditScore1(e.target.value)}
                            className="score-input"
                            style={{ width: 44, height: 36, textAlign: 'center', fontSize: 16, fontWeight: 700, borderRadius: 8 }}
                          />
                          <span style={{ fontWeight: 700, color: '#64748b' }}>×</span>
                          <input
                            type="number" min="0"
                            value={editScore2}
                            onChange={e => setEditScore2(e.target.value)}
                            className="score-input"
                            style={{ width: 44, height: 36, textAlign: 'center', fontSize: 16, fontWeight: 700, borderRadius: 8 }}
                          />
                          <button
                            onClick={() => handleAdminSave(game.number)}
                            disabled={saving || editScore1 === '' || editScore2 === ''}
                            style={{ backgroundColor: '#FFD100', color: '#1a1a1a', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                          >
                            {saving ? '...' : 'Salvar'}
                          </button>
                          <button
                            onClick={() => { setAdminEditing(null) }}
                            style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
