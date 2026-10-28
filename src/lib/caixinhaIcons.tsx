import React from 'react'
import {
  Utensils,
  Car,
  Home,
  HeartPulse,
  Gamepad2,
  BookOpen,
  Banknote,
  TrendingUp,
  ShoppingBag,
  Film,
  Plane,
  Gift,
  Heart,
  Gem,
  Coffee,
  GraduationCap,
  Sparkles,
  Smile,
  ShieldCheck,
  PiggyBank,
  Palmtree,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

export interface IconOption {
  id: string
  label: string
  icon: LucideIcon
}

export const CAIXINHA_ICONS: IconOption[] = [
  { id: 'plane', label: 'Viagem / Férias', icon: Plane },
  { id: 'palmtree', label: 'Praia / Férias', icon: Palmtree },
  { id: 'gift', label: 'Presentes / Festas', icon: Gift },
  { id: 'gem', label: 'Casamento / Conquista', icon: Gem },
  { id: 'heart', label: 'Sonho / Família', icon: Heart },
  { id: 'car', label: 'Carro / Transporte', icon: Car },
  { id: 'home', label: 'Casa / Reforma', icon: Home },
  { id: 'utensils', label: 'Alimentação / Restaurantes', icon: Utensils },
  { id: 'coffee', label: 'Café / Momentos', icon: Coffee },
  { id: 'shopping-bag', label: 'Compras / Roupas', icon: ShoppingBag },
  { id: 'gamepad', label: 'Lazer / Games', icon: Gamepad2 },
  { id: 'film', label: 'Filmes / Streaming', icon: Film },
  { id: 'heart-pulse', label: 'Saúde / Bem-estar', icon: HeartPulse },
  { id: 'graduation-cap', label: 'Estudos / Cursos', icon: GraduationCap },
  { id: 'book', label: 'Educação / Livros', icon: BookOpen },
  { id: 'banknote', label: 'Salário / Renda Extra', icon: Banknote },
  { id: 'trending-up', label: 'Investimentos / Futuro', icon: TrendingUp },
  { id: 'piggy-bank', label: 'Reserva de Emergência', icon: PiggyBank },
  { id: 'shield-check', label: 'Seguros / Proteção', icon: ShieldCheck },
  { id: 'sparkles', label: 'Meta Especial', icon: Sparkles },
  { id: 'smile', label: 'Cuidado Pessoal', icon: Smile },
  { id: 'ellipsis', label: 'Outros', icon: MoreHorizontal },
]

export const CAIXINHA_COLORS = [
  '#f59e0b', // Amber / Ouro
  '#3b82f6', // Azul Céu
  '#8b5cf6', // Violeta / Roxo
  '#ef4444', // Vermelho
  '#ec4899', // Rosa vibrante
  '#06b6d4', // Ciano
  '#10b981', // Verde esmeralda
  '#6366f1', // Indigo
  '#f97316', // Laranja
  '#14b8a6', // Teal
  '#a855f7', // Roxo suave
  '#64748b', // Ardósia / Neutro
]

export function getCaixinhaIconComponent(iconId?: string): LucideIcon {
  const match = CAIXINHA_ICONS.find((item) => item.id === iconId)
  if (match) return match.icon

  // Fallbacks for legacy icon ids
  switch (iconId) {
    case 'utensils':
      return Utensils
    case 'car':
      return Car
    case 'home':
      return Home
    case 'heart-pulse':
      return HeartPulse
    case 'gamepad':
    case 'gamepad2':
      return Gamepad2
    case 'book':
      return BookOpen
    case 'shopping-bag':
      return ShoppingBag
    case 'film':
      return Film
    case 'banknote':
      return Banknote
    case 'trending-up':
      return TrendingUp
    case 'plane':
      return Plane
    case 'gift':
      return Gift
    case 'gem':
    case 'ring':
      return Gem
    case 'palmtree':
      return Palmtree
    case 'heart':
      return Heart
    case 'coffee':
      return Coffee
    case 'graduation-cap':
      return GraduationCap
    case 'piggy-bank':
      return PiggyBank
    default:
      return PiggyBank
  }
}

export function renderCaixinhaIcon(
  iconId: string | undefined,
  className = 'w-4 h-4',
  style?: React.CSSProperties,
) {
  const Icon = getCaixinhaIconComponent(iconId)
  return <Icon className={className} style={style} />
}
