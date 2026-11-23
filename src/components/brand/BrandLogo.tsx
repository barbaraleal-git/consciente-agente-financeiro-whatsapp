import React, { useState } from 'react'
import { cn } from '@/lib/utils'

// ARQUIVOS REAIS (byte a byte) da dona, importados pelo bundler.
// O Vite embute os arquivos no build com nome hasheado — sem depender de
// public/brand/ (caminho público que falhou repetidamente nesta história).
import logoIconUrl from '@/assets/logooficialconsciente-7ccfd.jpg'
import logoFullUrl from '@/assets/logooficialconscientecomnomeeslogan-9e384.jpg'

/* ==========================================================================
   Logo oficial da marca Consciente — ARQUIVOS REAIS enviados pela dona.

   REGRA (decisão da dona): o logo exibido no app deve ser EXATAMENTE o
   arquivo oficial, nunca um redesenho. Este componente renderiza <img>
   apontando para os IMPORTS do bundler acima (src/assets/), garantindo que
   os bytes exatos dos arquivos originais cheguem ao build.

   O fallback SVG abaixo existe APENAS como rede de segurança (onError):
   só aparece se o próprio import do asset falhar. Nunca no funcionamento
   normal.

   Favicon (index.html): segue apontando para /brand/ (servindo no vivo);
   os pontos críticos renderizados na UI (login, sidebar, header mobile)
   usam os imports acima.
   ========================================================================== */

export const BRAND = {
  petrol: '#2A5F6E',
  petrolDark: '#1E4A5A',
  gold: '#F0C24B',
  terracotta: '#D96B47',
  cream: '#F8F3E3',
} as const

/** URLs dos arquivos de logo REAIS da dona (imports do bundler). */
export const LOGO_FILES = {
  /** Sem nome — sidebar, header mobile e favicon. */
  icon: logoIconUrl,
  /** Com nome "Consciente" + tagline "Seu Parceiro nas Finanças" — login. */
  full: logoFullUrl,
} as const

interface BrandLogoProps {
  className?: string
  /** 'icon' = logo sem nome (sidebar, header); 'full' = com nome e tagline (login) */
  variant?: 'icon' | 'full'
  title?: string
}

/* --------------------------------------------------------------------------
   <img> do arquivo real (import do bundler) com fallback automático
   apenas em caso de falha de carregamento (onError).
   -------------------------------------------------------------------------- */

const RealLogoImage: React.FC<{
  src: string
  alt: string
  className?: string
  fallback: React.ReactNode
  onError?: () => void
}> = ({ src, alt, className, fallback, onError }) => {
  const [failed, setFailed] = useState(false)

  if (!src || failed) return <>{fallback}</>

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
   FALLBACK (rede de segurança): SVG aproximado, exibido APENAS se o import
   do asset falhar (URL vazia ou erro de carregamento). NÃO é o logo oficial
   e nunca aparece no funcionamento normal.

   ⚠️ PROTOCOLO PERMANENTE: os src NUNCA mais devem apontar para /brand/
   (pasta pública que falhou repetidamente — pasta vazia, cópia nunca
   aconteceu, cache). Sempre imports do bundler a partir de src/assets/.
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
