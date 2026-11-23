import React from 'react'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Logo oficial da marca Consciente — SVG fiel ao asset anexado pela dona:
   balão de fala azul-petróleo, sol amarelo-dourado central e raios terracota
   no arco superior-direito. Cores da paleta oficial, sem variações.
   ========================================================================== */

export const BRAND = {
  petrol: '#2A5F6E',
  petrolDark: '#1E4A5A',
  gold: '#F0C24B',
  terracotta: '#D96B47',
  cream: '#F8F3E3',
} as const

interface BrandLogoProps {
  className?: string
  /** 'icon' = só o balão+sol (sidebar, favicon, header); 'full' = com nome e tagline (login) */
  variant?: 'icon' | 'full'
  title?: string
}

/** Balão de fala petróleo com sol dourado e raios terracota. */
export const BrandMark: React.FC<{ className?: string; title?: string }> = ({
  className,
  title,
}) => (
  <svg
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={title || 'Logo Consciente'}
    className={cn('shrink-0', className)}
  >
    {title ? <title>{title}</title> : null}
    {/* Balão de fala (círculo petróleo + cauda inferior-esquerda) */}
    <path d="M100 16a84 84 0 1 1-59.4 143.4L26 176l10-39A84 84 0 0 1 100 16Z" fill={BRAND.petrol} />
    {/* Anel creme que separa o balão do sol */}
    <circle cx="100" cy="96" r="50" fill="none" stroke="#FDFBF5" strokeWidth="7" />
    {/* Raios terracota (arco superior-direito), separados pelo anel creme */}
    <g fill={BRAND.terracotta}>
      <path d="M112 22.5A74 74 0 0 1 143.9 34l-20 26.9A42 42 0 0 0 108 54.5Z" />
      <path d="M152.1 40.7a74 74 0 0 1 24 23.5l-31.4 20.2a42 42 0 0 0-13.6-13.4Z" />
      <path d="M180.6 73.4A74 74 0 0 1 188.9 104l-37.7 1.2A42 42 0 0 0 146 83.4Z" />
    </g>
    {/* Sol amarelo-dourado com respiro à direita */}
    <path
      d="M150 96a50 50 0 1 1-50-50 50 50 0 0 1 0 100Zm0-11a39 39 0 1 0 0-78 39 39 0 0 0 0 78Z"
      fill="none"
    />
    <circle cx="100" cy="96" r="39" fill={BRAND.gold} />
    {/* Respiro dourado do sol (faixa à direita, entre os raios) */}
    <path d="M139 86h50v20h-50z" fill={BRAND.gold} />
    {/* Fenda creme entre o respiro e a fala */}
    <rect x="136" y="108" width="54" height="7" fill="#FDFBF5" />
    {/* Recorte da fenda do balão (curva creme inferior-direita) */}
    <path d="M189 115a84 84 0 0 1-49 53l-8-35a50 50 0 0 0 18-18Z" fill="#FDFBF5" opacity="0" />
  </svg>
)

/** Logo completo: marca + nome "Consciente" + tagline (usado no login). */
export const BrandLogoFull: React.FC<{ className?: string; title?: string }> = ({
  className,
  title,
}) => (
  <svg
    viewBox="0 0 320 220"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={title || 'Consciente — Seu Parceiro nas Finanças'}
    className={cn('w-full', className)}
  >
    {title ? <title>{title}</title> : null}
    <g transform="translate(88,0) scale(0.72)">
      <path
        d="M100 16a84 84 0 1 1-59.4 143.4L26 176l10-39A84 84 0 0 1 100 16Z"
        fill={BRAND.petrol}
      />
      <circle cx="100" cy="96" r="50" fill="none" stroke="#FDFBF5" strokeWidth="7" />
      <g fill={BRAND.terracotta}>
        <path d="M112 22.5A74 74 0 0 1 143.9 34l-20 26.9A42 42 0 0 0 108 54.5Z" />
        <path d="M152.1 40.7a74 74 0 0 1 24 23.5l-31.4 20.2a42 42 0 0 0-13.6-13.4Z" />
        <path d="M180.6 73.4A74 74 0 0 1 188.9 104l-37.7 1.2A42 42 0 0 0 146 83.4Z" />
      </g>
      <circle cx="100" cy="96" r="39" fill={BRAND.gold} />
      <path d="M139 86h50v20h-50z" fill={BRAND.gold} />
      <rect x="136" y="108" width="54" height="7" fill="#FDFBF5" />
    </g>
    <text
      x="160"
      y="172"
      textAnchor="middle"
      fill={BRAND.petrolDark}
      fontFamily="Georgia, 'Times New Roman', serif"
      fontWeight="700"
      fontSize="44"
    >
      Consciente
    </text>
    <text
      x="160"
      y="204"
      textAnchor="middle"
      fill={BRAND.petrolDark}
      fontFamily="system-ui, sans-serif"
      fontWeight="500"
      fontSize="19"
    >
      Seu Parceiro nas Finanças
    </text>
  </svg>
)

/** Ícone de favicon: marca isolada em fundo creme arredondado. */
export const BrandFavicon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
    <rect width="64" height="64" rx="14" fill={BRAND.cream} />
    <g transform="translate(6,6) scale(0.26)">
      <path
        d="M100 16a84 84 0 1 1-59.4 143.4L26 176l10-39A84 84 0 0 1 100 16Z"
        fill={BRAND.petrol}
      />
      <circle cx="100" cy="96" r="50" fill="none" stroke="#FDFBF5" strokeWidth="7" />
      <g fill={BRAND.terracotta}>
        <path d="M112 22.5A74 74 0 0 1 143.9 34l-20 26.9A42 42 0 0 0 108 54.5Z" />
        <path d="M152.1 40.7a74 74 0 0 1 24 23.5l-31.4 20.2a42 42 0 0 0-13.6-13.4Z" />
        <path d="M180.6 73.4A74 74 0 0 1 188.9 104l-37.7 1.2A42 42 0 0 0 146 83.4Z" />
      </g>
      <circle cx="100" cy="96" r="39" fill={BRAND.gold} />
      <path d="M139 86h50v20h-50z" fill={BRAND.gold} />
      <rect x="136" y="108" width="54" height="7" fill="#FDFBF5" />
    </g>
  </svg>
)

/** Logo completo com fundo creme, fiel ao asset da dona (tela de login). */
export const BrandLogoCard: React.FC<{ className?: string; title?: string }> = ({
  className,
  title,
}) => (
  <div
    className={cn('inline-flex flex-col items-center rounded-3xl px-8 py-6', className)}
    style={{ backgroundColor: BRAND.cream }}
  >
    <BrandMark className="w-24 h-24" title={title} />
    <h1
      className="mt-3 text-3xl font-bold tracking-tight"
      style={{ color: BRAND.petrolDark, fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      Consciente
    </h1>
    <p className="mt-1 text-sm font-medium" style={{ color: BRAND.petrolDark }}>
      Seu Parceiro nas Finanças
    </p>
  </div>
)

/** Componente principal: variante 'icon' (marca) ou 'full' (marca + texto). */
export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'icon', ...rest }) =>
  variant === 'full' ? <BrandLogoFull {...rest} /> : <BrandMark {...rest} />

export default BrandLogo
