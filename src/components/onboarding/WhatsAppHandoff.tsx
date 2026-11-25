import React, { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { Button } from '@/components/ui/button'
import { getWhatsAppHandoffUrl } from '@/lib/whatsapp'

interface WhatsAppHandoffProps {
  /** Chamado quando o usuário escolhe qualquer caminho (WhatsApp ou app). */
  onDone: () => void
}

/**
 * Tela de celebração no fim do onboarding: entrega o cliente ao WhatsApp
 * (canal principal do produto). Fundo creme de marca, botão verde wa.me
 * com mensagem pré-digitada, QR code no desktop e link discreto para
 * explorar o app primeiro.
 */
export const WhatsAppHandoff: React.FC<WhatsAppHandoffProps> = ({ onDone }) => {
  const waUrl = useMemo(() => getWhatsAppHandoffUrl(), [])

  const handleOpenWhatsApp = () => {
    // nova aba não bloqueada: navegação direta via href com target _blank
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    onDone()
  }

  return (
    <div className="min-h-dvh bg-brand-cream flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-5">
        <BrandLogo className="h-14" />

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-petrol-dark tracking-tight">
            Sua conta está pronta! 🎉
          </h1>
          <p className="text-sm sm:text-base text-brand-petrol leading-relaxed">
            Agora, o mais importante: o Consciente vive no WhatsApp.
          </p>
          <p className="text-xs sm:text-sm text-brand-petrol/80 leading-relaxed">
            É por lá que você registra seus gastos conversando — por texto ou áudio, do jeito que
            você fala. Seu painel aqui no app mostra tudo organizado em caixinhas.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenWhatsApp}
          className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-semibold text-base py-3 rounded-xl shadow-lg shadow-[#25D366]/30"
        >
          💬 Abrir no WhatsApp
        </Button>

        {/* QR code apenas no desktop (md+), para continuar pelo celular */}
        <div className="hidden md:flex flex-col items-center gap-3 pt-2">
          <div className="p-3 bg-white rounded-2xl border border-brand-petrol/15 shadow-sm">
            <QRCodeSVG value={waUrl} size={168} marginSize={2} aria-hidden="true" />
          </div>
          <p className="text-xs text-brand-petrol/70 max-w-[26ch] leading-relaxed">
            Está no computador? Aponte a câmera do celular e continue no WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="text-xs text-brand-petrol/60 hover:text-brand-petrol underline underline-offset-4 transition-colors mt-2"
        >
          Prefiro explorar o app primeiro →
        </button>
      </div>
    </div>
  )
}

export default WhatsAppHandoff
