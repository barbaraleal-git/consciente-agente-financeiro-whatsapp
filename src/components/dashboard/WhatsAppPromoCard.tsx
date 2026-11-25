import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getWhatsAppHandoffUrl } from '@/lib/whatsapp'

/**
 * Card creme no topo do Dashboard: destaca o WhatsApp (canal principal)
 * enquanto o cliente não tem NENHUMA transação com source='whatsapp*'.
 * Some sozinho assim que a 1ª transação via WhatsApp existir.
 */
export const WhatsAppPromoCard: React.FC = () => {
  return (
    <Card className="border-brand-gold/40 bg-brand-cream shadow-sm">
      <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 space-y-1.5">
          <h3 className="text-base font-bold text-brand-petrol-dark">
            💬 A melhor parte fica no WhatsApp
          </h3>
          <p className="text-sm text-brand-petrol leading-relaxed">
            Registre seus gastos conversando: texto ou áudio. Experimente:{' '}
            <span className="font-semibold text-brand-petrol-dark">"gastei R$ 35 no mercado"</span>{' '}
            🎙️
          </p>
        </div>
        <Button
          asChild
          className="bg-[#25D366] hover:bg-[#1DA851] text-white font-semibold shrink-0 shadow-md shadow-[#25D366]/30"
        >
          <a
            href={getWhatsAppHandoffUrl()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir conversa com o Consciente no WhatsApp"
          >
            💬 Abrir no WhatsApp
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

export default WhatsAppPromoCard
