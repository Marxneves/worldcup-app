export const TEAM_ABBR: Record<string, string> = {
  'México': 'MEX', 'África do Sul': 'RSA', 'Coreia do Sul': 'KOR', 'Tchéquia': 'CZE',
  'Canadá': 'CAN', 'Bósnia e Herzegovina': 'BIH', 'Estados Unidos': 'USA', 'Paraguai': 'PAR',
  'Catar': 'QAT', 'Suíça': 'SUI', 'Brasil': 'BRA', 'Marrocos': 'MAR',
  'Haiti': 'HAI', 'Escócia': 'SCO', 'Austrália': 'AUS', 'Turquia': 'TUR',
  'Alemanha': 'GER', 'Curaçao': 'CUW', 'Holanda': 'NED', 'Japão': 'JPN',
  'Costa do Marfim': 'CIV', 'Equador': 'ECU', 'Suécia': 'SWE', 'Tunísia': 'TUN',
  'Espanha': 'ESP', 'Cabo Verde': 'CPV', 'Bélgica': 'BEL', 'Egito': 'EGY',
  'Arábia Saudita': 'KSA', 'Uruguai': 'URU', 'Irã': 'IRI', 'Nova Zelândia': 'NZL',
  'França': 'FRA', 'Senegal': 'SEN', 'Iraque': 'IRQ', 'Noruega': 'NOR',
  'Argentina': 'ARG', 'Argélia': 'ALG', 'Áustria': 'AUT', 'Jordânia': 'JOR',
  'Portugal': 'POR', 'RD Congo': 'COD', 'Inglaterra': 'ENG', 'Croácia': 'CRO',
  'Gana': 'GHA', 'Panamá': 'PAN', 'Uzbequistão': 'UZB', 'Colômbia': 'COL',
}

export const FLAG_CODES: Record<string, string> = {
  'México': 'mx',
  'África do Sul': 'za',
  'Coreia do Sul': 'kr',
  'Tchéquia': 'cz',
  'Canadá': 'ca',
  'Bósnia e Herzegovina': 'ba',
  'Estados Unidos': 'us',
  'Paraguai': 'py',
  'Catar': 'qa',
  'Suíça': 'ch',
  'Brasil': 'br',
  'Marrocos': 'ma',
  'Haiti': 'ht',
  'Escócia': 'gb-sct',
  'Austrália': 'au',
  'Turquia': 'tr',
  'Alemanha': 'de',
  'Curaçao': 'cw',
  'Holanda': 'nl',
  'Japão': 'jp',
  'Costa do Marfim': 'ci',
  'Equador': 'ec',
  'Suécia': 'se',
  'Tunísia': 'tn',
  'Espanha': 'es',
  'Cabo Verde': 'cv',
  'Bélgica': 'be',
  'Egito': 'eg',
  'Arábia Saudita': 'sa',
  'Uruguai': 'uy',
  'Irã': 'ir',
  'Nova Zelândia': 'nz',
  'França': 'fr',
  'Senegal': 'sn',
  'Iraque': 'iq',
  'Noruega': 'no',
  'Argentina': 'ar',
  'Argélia': 'dz',
  'Áustria': 'at',
  'Jordânia': 'jo',
  'Portugal': 'pt',
  'RD Congo': 'cd',
  'Inglaterra': 'gb-eng',
  'Croácia': 'hr',
  'Gana': 'gh',
  'Panamá': 'pa',
  'Uzbequistão': 'uz',
  'Colômbia': 'co',
}

interface FlagImageProps {
  team: string
  size?: number
  className?: string
}

// Suíça tem bandeira quadrada (1:1); todas as outras seguem proporção 3:2
function flagWidth(code: string, height: number): number {
  return code === 'ch' ? height : Math.round(height * 1.5)
}

export default function FlagImage({ team, size = 40, className = '' }: FlagImageProps) {
  const code = FLAG_CODES[team]
  if (!code) return <span className="text-xl">🏳️</span>

  return (
    <img
      src={`/flags/${code}.png`}
      alt={team}
      width={flagWidth(code, size)}
      height={size}
      className={`rounded-sm ${className}`}
    />
  )
}
