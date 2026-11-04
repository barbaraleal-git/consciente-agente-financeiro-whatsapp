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
  icon?: LucideIcon
  emoji?: string
  category?: 'bichinho' | 'geral' | 'emoji'
}

// Lista de figurinhas de bichinhos amigáveis
export const BICHINHO_ICONS: IconOption[] = [
  { id: 'pet-cat', label: 'Gatinho', emoji: '🐱', category: 'bichinho' },
  { id: 'pet-dog', label: 'Cachorrinho', emoji: '🐶', category: 'bichinho' },
  { id: 'pet-paw', label: 'Patinhas / Pet', emoji: '🐾', category: 'bichinho' },
  { id: 'pet-bear', label: 'Ursinho', emoji: '🐻', category: 'bichinho' },
  { id: 'pet-panda', label: 'Panda', emoji: '🐼', category: 'bichinho' },
  { id: 'pet-koala', label: 'Coala', emoji: '🐨', category: 'bichinho' },
  { id: 'pet-lion', label: 'Leãozinho', emoji: '🦁', category: 'bichinho' },
  { id: 'pet-rabbit', label: 'Coelhinho', emoji: '🐰', category: 'bichinho' },
  { id: 'pet-fox', label: 'Raposa', emoji: '🦊', category: 'bichinho' },
  { id: 'pet-hamster', label: 'Hamster', emoji: '🐹', category: 'bichinho' },
  { id: 'pet-tiger', label: 'Tigrinho', emoji: '🐯', category: 'bichinho' },
  { id: 'pet-penguin', label: 'Pinguim', emoji: '🐧', category: 'bichinho' },
  { id: 'pet-duck', label: 'Patinho', emoji: '🦆', category: 'bichinho' },
  { id: 'pet-owl', label: 'Corujinha', emoji: '🦉', category: 'bichinho' },
  { id: 'pet-monkey', label: 'Macaco', emoji: '🐵', category: 'bichinho' },
  { id: 'pet-dolphin', label: 'Golfinho', emoji: '🐬', category: 'bichinho' },
  { id: 'pet-butterfly', label: 'Borboleta', emoji: '🦋', category: 'bichinho' },
  { id: 'pet-bee', label: 'Abelhinha', emoji: '🐝', category: 'bichinho' },
]

// Lista de emojis populares para finanças e estilo de vida
export const EMOJI_ICONS: IconOption[] = [
  { id: 'emoji:💰', label: 'Saco de Dinheiro', emoji: '💰', category: 'emoji' },
  { id: 'emoji:💵', label: 'Dinheiro', emoji: '💵', category: 'emoji' },
  { id: 'emoji:💳', label: 'Cartão de Crédito', emoji: '💳', category: 'emoji' },
  { id: 'emoji:🎯', label: 'Alvo / Meta', emoji: '🎯', category: 'emoji' },
  { id: 'emoji:🍕', label: 'Pizza / Delivery', emoji: '🍕', category: 'emoji' },
  { id: 'emoji:🍔', label: 'Hambúrguer / Lanches', emoji: '🍔', category: 'emoji' },
  { id: 'emoji:☕', label: 'Café', emoji: '☕', category: 'emoji' },
  { id: 'emoji:🛒', label: 'Supermercado', emoji: '🛒', category: 'emoji' },
  { id: 'emoji:🚗', label: 'Carro / Gasolina', emoji: '🚗', category: 'emoji' },
  { id: 'emoji:✈️', label: 'Viagem / Voo', emoji: '✈️', category: 'emoji' },
  { id: 'emoji:🏠', label: 'Casa / Moradia', emoji: '🏠', category: 'emoji' },
  { id: 'emoji:💊', label: 'Farmácia / Remédios', emoji: '💊', category: 'emoji' },
  { id: 'emoji:🏋️', label: 'Academia / Esporte', emoji: '🏋️', category: 'emoji' },
  { id: 'emoji:👕', label: 'Roupas / Moda', emoji: '👕', category: 'emoji' },
  { id: 'emoji:📚', label: 'Livros / Cursos', emoji: '📚', category: 'emoji' },
  { id: 'emoji:🎮', label: 'Games / Jogos', emoji: '🎮', category: 'emoji' },
  { id: 'emoji:🍿', label: 'Cinema / Lazer', emoji: '🍿', category: 'emoji' },
  { id: 'emoji:🎁', label: 'Presentes / Festas', emoji: '🎁', category: 'emoji' },
  { id: 'emoji:👶', label: 'Filhos / Bebê', emoji: '👶', category: 'emoji' },
  { id: 'emoji:💇', label: 'Salão / Beleza', emoji: '💇', category: 'emoji' },
  { id: 'emoji:📱', label: 'Celular / Internet', emoji: '📱', category: 'emoji' },
  { id: 'emoji:💡', label: 'Contas / Energia', emoji: '💡', category: 'emoji' },
  { id: 'emoji:🌴', label: 'Férias / Praia', emoji: '🌴', category: 'emoji' },
  { id: 'emoji:✨', label: 'Sonho / Especial', emoji: '✨', category: 'emoji' },
]

export const GERAL_ICONS: IconOption[] = [
  { id: 'plane', label: 'Viagem / Férias', icon: Plane, category: 'geral' },
  { id: 'palmtree', label: 'Praia / Férias', icon: Palmtree, category: 'geral' },
  { id: 'gift', label: 'Presentes / Festas', icon: Gift, category: 'geral' },
  { id: 'gem', label: 'Casamento / Conquista', icon: Gem, category: 'geral' },
  { id: 'heart', label: 'Sonho / Família', icon: Heart, category: 'geral' },
  { id: 'car', label: 'Carro / Transporte', icon: Car, category: 'geral' },
  { id: 'home', label: 'Casa / Reforma', icon: Home, category: 'geral' },
  { id: 'utensils', label: 'Alimentação / Restaurantes', icon: Utensils, category: 'geral' },
  { id: 'coffee', label: 'Café / Momentos', icon: Coffee, category: 'geral' },
  { id: 'shopping-bag', label: 'Compras / Roupas', icon: ShoppingBag, category: 'geral' },
  { id: 'gamepad', label: 'Lazer / Games', icon: Gamepad2, category: 'geral' },
  { id: 'film', label: 'Filmes / Streaming', icon: Film, category: 'geral' },
  { id: 'heart-pulse', label: 'Saúde / Bem-estar', icon: HeartPulse, category: 'geral' },
  { id: 'graduation-cap', label: 'Estudos / Cursos', icon: GraduationCap, category: 'geral' },
  { id: 'book', label: 'Educação / Livros', icon: BookOpen, category: 'geral' },
  { id: 'banknote', label: 'Salário / Renda Extra', icon: Banknote, category: 'geral' },
  { id: 'trending-up', label: 'Investimentos / Futuro', icon: TrendingUp, category: 'geral' },
  { id: 'piggy-bank', label: 'Reserva de Emergência', icon: PiggyBank, category: 'geral' },
  { id: 'shield-check', label: 'Seguros / Proteção', icon: ShieldCheck, category: 'geral' },
  { id: 'sparkles', label: 'Meta Especial', icon: Sparkles, category: 'geral' },
  { id: 'smile', label: 'Cuidado Pessoal', icon: Smile, category: 'geral' },
  { id: 'ellipsis', label: 'Outros', icon: MoreHorizontal, category: 'geral' },
]

export const CAIXINHA_ICONS: IconOption[] = [...BICHINHO_ICONS, ...EMOJI_ICONS, ...GERAL_ICONS]

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

export function isEmojiIcon(iconId?: string): boolean {
  if (!iconId) return false
  if (iconId.startsWith('emoji:') || iconId.startsWith('pet-')) return true
  // Se for um caractere emoji direto
  return /\p{Extended_Pictographic}/u.test(iconId)
}

export function getEmojiFromIconId(iconId?: string): string {
  if (!iconId) return '🐾'
  if (iconId.startsWith('emoji:')) return iconId.slice(6)
  const match = CAIXINHA_ICONS.find((item) => item.id === iconId)
  if (match && match.emoji) return match.emoji
  if (/\p{Extended_Pictographic}/u.test(iconId)) return iconId
  return '🐱'
}

export function getCaixinhaIconComponent(iconId?: string): LucideIcon {
  const match = GERAL_ICONS.find((item) => item.id === iconId)
  if (match && match.icon) return match.icon

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
  if (isEmojiIcon(iconId)) {
    const emoji = getEmojiFromIconId(iconId)
    return (
      <span
        className={`inline-flex items-center justify-center select-none leading-none ${className}`}
        style={style}
        role="img"
        aria-label="bichinho"
      >
        {emoji}
      </span>
    )
  }
  const Icon = getCaixinhaIconComponent(iconId)
  return <Icon className={className} style={style} />
}
