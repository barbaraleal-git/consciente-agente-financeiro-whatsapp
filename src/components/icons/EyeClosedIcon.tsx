import React from 'react'

export interface EyeClosedIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
}

/**
 * Ícone de Olho Fechado de verdade (pálpebra curva fechada com cílios apontando para baixo/fora).
 * Atende ao pedido estrito da dona do produto:
 * "um desenho de olhinho fechado (um olhinho fechado mesmo, não um olho aberto com uma barra por cima)".
 * Não utiliza barra diagonal (EyeOff).
 */
export const EyeClosedIcon: React.FC<EyeClosedIconProps> = ({
  className = 'w-4 h-4',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Arco curvo da pálpebra fechada */}
      <path d="M2 10s3.82 5 10 5 10-5 10-5" />
      {/* Cílios projetando-se para baixo a partir da pálpebra fechada */}
      <path d="M4.5 12.5L3 15.5" />
      <path d="M8 14.2L7 17.5" />
      <path d="M12 15v3.5" />
      <path d="M16 14.2l1 3.3" />
      <path d="M19.5 12.5L21 15.5" />
    </svg>
  )
}

export default EyeClosedIcon
