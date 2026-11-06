import React, { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { CompanyLegalInfo } from '@/services/finance'
import { ShieldCheck, Mail, MapPin, Building2, Phone } from 'lucide-react'

export const LegalFooter: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [legal, setLegal] = useState<CompanyLegalInfo | null>(null)

  useEffect(() => {
    let isMounted = true
    const loadLegal = async () => {
      try {
        const records = await pb.collection('company_legal_info').getFullList<CompanyLegalInfo>({
          sort: '-created',
        })
        if (isMounted && records.length > 0) {
          setLegal(records[0])
        }
      } catch (_) {
        // Fallback para valores padrão caso ocorra erro
      }
    }
    loadLegal()
    return () => {
      isMounted = false
    }
  }, [])

  const companyName = legal?.company_name || 'Consciente Gestão Financeira Inteligente Ltda.'
  const tradeName = legal?.trade_name || 'Consciente - Seu parceiro nas finanças'
  const cnpj = legal?.cnpj || '53.842.190/0001-38'
  const address =
    legal?.address_full || 'Av. Paulista, 1000, Bela Vista, São Paulo - SP, CEP 01310-100'
  const email = legal?.email_contact || 'contato@consciente.app.br'
  const phone = legal?.support_phone_or_bot || '+55 (11) 94998-9868'

  return (
    <footer
      className={`border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 py-6 px-4 text-xs transition-colors ${className}`}
    >
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">{tradeName}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Conforme Decreto Federal nº 7.962/2013 (Comércio Eletrônico) e CDC
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span>
                <strong>Razão Social:</strong> {companyName}
              </span>
            </div>
            <div>
              <strong>CNPJ:</strong> {cnpj}
            </div>
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
              <span>
                <strong>Endereço:</strong> {address}
              </span>
            </div>
          </div>

          <div className="space-y-1 md:text-right">
            <div className="flex items-center md:justify-end gap-1.5">
              <Mail className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span>
                <strong>Atendimento/Suporte:</strong>{' '}
                <a
                  href={`mailto:${email}`}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {email}
                </a>
              </span>
            </div>
            {phone && (
              <div className="flex items-center md:justify-end gap-1.5">
                <Phone className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                <span>
                  <strong>WhatsApp Oficial:</strong> {phone}
                </span>
              </div>
            )}
            <div className="text-[10px] text-slate-500 pt-1">
              Direito de arrependimento garantido em até 7 dias corridos após a contratação (Art. 49
              do CDC). Cobrança 100% segura e intermediada pela Stripe (PCI-DSS Compliance).
            </div>
          </div>
        </div>

        <div className="text-[10px] text-center text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          © {new Date().getFullYear()} Consciente. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}

export default LegalFooter
