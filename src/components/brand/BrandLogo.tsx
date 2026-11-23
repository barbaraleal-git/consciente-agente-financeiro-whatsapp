import React, { useState } from 'react'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Logo oficial da marca Consciente — ARQUIVOS REAIS enviados pela dona.

   REGRA (decisão da dona): o logo exibido no app deve ser EXATAMENTE o
   arquivo oficial, nunca um redesenho. Este componente renderiza <img>
   apontando para os arquivos reais em public/brand/:

     - Logo_Oficial_Consciente-c56d4.jpg                    (sem nome — sidebar, header mobile, favicon)
     - Logo_Oficial_Consciente_com_Nome_e_Slogan-929ed.jpg  (com nome + tagline — login)

   ⚠️ Os arquivos devem existir em public/brand/ com esses nomes exatos
   (ver public/brand/LEIA-ME.txt). Enquanto não estiverem presentes, o
   fallback SVG abaixo é exibido automaticamente (onError) para o app não
   quebrar — o fallback é temporário e NÃO substitui o arquivo oficial.

   Favicon (index.html): usa o arquivo real sem nome diretamente
   (type="image/jpeg"), a partir do arquivo oficial — sem redesenho.
   ========================================================================== */

export const BRAND = {
  petrol: '#2A5F6E',
  petrolDark: '#1E4A5A',
  gold: '#F0C24B',
  terracotta: '#D96B47',
  cream: '#F8F3E3',
} as const

/** Caminhos (rota pública) dos arquivos de logo REAIS da dona. */
export const LOGO_FILES = {
  /** Sem nome — sidebar, header mobile e favicon. */
  icon: '/brand/Logo_Oficial_Consciente.jpg',
  /** Com nome "Consciente" + tagline "Seu Parceiro nas Finanças" — login. */
  full: '/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg',
} as const

interface BrandLogoProps {
  className?: string
  /** 'icon' = logo sem nome (sidebar, header); 'full' = com nome e tagline (login) */
  variant?: 'icon' | 'full'
  title?: string
}

/* --------------------------------------------------------------------------
   <img> do arquivo real com fallback automático enquanto o arquivo não
   estiver presente em public/brand/.
   -------------------------------------------------------------------------- */

const RealLogoImage: React.FC<{
  src: string
  alt: string
  className?: string
  fallback: React.ReactNode
  onError?: () => void
}> = ({ src, alt, className, fallback, onError }) => {
  const [failed, setFailed] = useState(false)

  if (failed) return <>{fallback}</>

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn('object-contain select-none', className)}
      onError={() => {
        setFailed(true)
        onError?.()
      }}
    />
  )
}

/* --------------------------------------------------------------------------
   FALLBACK (temporário): SVG aproximado da rodada anterior, exibido apenas
   enquanto o arquivo real não existir em public/brand/. NÃO é o logo oficial.
   -------------------------------------------------------------------------- */

const FallbackMark: React.FC<{ className?: string; title?: string }> = ({ className, title }) => (
  <svg
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label={title || 'Logo Consciente'}
    className={cn('shrink-0', className)}
  >
    {title ? <title>{title}</title> : null}
    <path d="M100 16a84 84 0 1 1-59.4 143.4L26 176l10-39A84 84 0 0 1 100 16Z" fill={BRAND.petrol} />
    <circle cx="100" cy="96" r="50" fill="none" stroke="#FDFBF5" strokeWidth="7" />
    <g fill={BRAND.terracotta}>
      <path d="M112 22.5A74 74 0 0 1 143.9 34l-20 26.9A42 42 0 0 0 108 54.5Z" />
      <path d="M152.1 40.7a74 74 0 0 1 24 23.5l-31.4 20.2a42 42 0 0 0-13.6-13.4Z" />
      <path d="M180.6 73.4A74 74 0 0 1 188.9 104l-37.7 1.2A42 42 0 0 0 146 83.4Z" />
    </g>
    <circle cx="100" cy="96" r="39" fill={BRAND.gold} />
    <path d="M139 86h50v20h-50z" fill={BRAND.gold} />
    <rect x="136" y="108" width="54" height="7" fill="#FDFBF5" />
  </svg>
)

const FallbackFull: React.FC<{ className?: string; title?: string }> = ({ className, title }) => (
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

/* --------------------------------------------------------------------------
   Componentes públicos — API inalterada (Layout.tsx e Login.tsx não mudam).
   -------------------------------------------------------------------------- */

/** Logo SEM nome (arquivo real): sidebar e header mobile. */
export const BrandMark: React.FC<{ className?: string; title?: string }> = ({
  className,
  title,
}) => (
  <RealLogoImage
    src={LOGO_FILES.icon}
    alt={title || 'Logo Consciente'}
    className={className}
    fallback={<FallbackMark className={className} title={title} />}
  />
)

/** Logo COM nome + tagline (arquivo real): tela de login. */
export const BrandLogoFull: React.FC<{ className?: string; title?: string }> = ({
  className,
  title,
}) => (
  <RealLogoImage
    src={LOGO_FILES.full}
    alt={title || 'Consciente — Seu Parceiro nas Finanças'}
    className={className}
    fallback={<FallbackFull className={className} title={title} />}
  />
)

/** Ícone de favicon: mantido por compatibilidade — o favicon real é o
 * arquivo oficial referenciado direto no index.html (type image/jpeg). */
export const BrandFavicon: React.FC<{ className?: string }> = ({ className }) => (
  <RealLogoImage
    src={LOGO_FILES.icon}
    alt="Favicon Consciente"
    className={className}
    fallback={<FallbackMark className={className} />}
  />
)

/** Logo completo sobre cartão creme (tela de login) — arquivo real da dona. */
export const BrandLogoCard: React.FC<{ className?: string; title?: string }> = ({
  className,
  title,
}) => (
  <div
    className={cn('inline-flex flex-col items-center overflow-hidden rounded-3xl', className)}
    style={{ backgroundColor: BRAND.cream }}
  >
    <RealLogoImage
      src={LOGO_FILES.full}
      alt={title || 'Consciente — Seu Parceiro nas Finanças'}
      className="w-full max-w-[280px]"
      fallback={
        <div className="flex flex-col items-center px-8 py-6">
          <FallbackMark className="w-24 h-24" title={title} />
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
      }
    />
  </div>
)

/** Componente principal: variante 'icon' (sem nome) ou 'full' (com nome). */
export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'icon', ...rest }) =>
  variant === 'full' ? <BrandLogoFull {...rest} /> : <BrandMark {...rest} />

export default BrandLogo
