/**
 * Número do bot de WhatsApp e helpers de link wa.me.
 * Mesmo número já usado no projeto (whatsapp_bridge.js: '+55 11 94998-9868').
 * Ponto único de verdade para todos os links de WhatsApp do frontend.
 */
export const WHATSAPP_BOT_NUMBER = '5511949989868'

/** Mensagem pré-digitada exata do fim do onboarding. */
export const WHATSAPP_ONBOARDING_MESSAGE =
  'Oi! Acabei de criar minha conta no Consciente e quero começar a controlar meus gastos por aqui!'

/** Link wa.me com a mensagem do onboarding pré-codificada. */
export function getWhatsAppHandoffUrl(): string {
  return `https://wa.me/${WHATSAPP_BOT_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_ONBOARDING_MESSAGE,
  )}`
}

/** Link wa.me simples (sem mensagem), para cards e atalhos. */
export function getWhatsAppOpenUrl(): string {
  return `https://wa.me/${WHATSAPP_BOT_NUMBER}`
}
