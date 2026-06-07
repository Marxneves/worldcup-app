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

export default function FlagImage({ team, size = 40, className = '' }: FlagImageProps) {
  const code = FLAG_CODES[team]
  if (!code) return <span className="text-xl">🏳️</span>

  return (
    <img
      src={`/flags/${code}.png`}
      alt={team}
      width={size}
      height={size}
      className={`rounded-sm object-cover ${className}`}
    />
  )
}
