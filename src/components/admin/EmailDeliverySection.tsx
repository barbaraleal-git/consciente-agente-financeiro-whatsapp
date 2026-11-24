import { useEffect, useState } from 'react'
import { Mail, RefreshCw, Save, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { adminService, type EmailDeliveryStatus } from '@/services/finance'
import { cn } from '@/lib/utils'

// v0.0.159 — Caminho duplo de e-mail: toggle da dona no backoffice admin.
// 'platform' = retransmissor nativo Skip (contingência, padrão atual);
// 'resend' = API HTTPS do Resend (domínio próprio). O backend faz fallback
// automático para platform se o Resend falhar ou não tiver chave.

type DeliveryMode = 'platform' | 'resend'

const MODE_LABEL: Record<DeliveryMode, string> = {
  platform: 'Plataforma (contingência)',
  resend: 'Resend (domínio próprio)',
}

export function EmailDeliverySection() {
  const { toast } = useToast()
  const [status, setStatus] = useState<EmailDeliveryStatus | null>(null)
  const [selected, setSelected] = useState<DeliveryMode>('platform')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await adminService.getEmailDeliveryMode()
      setStatus(s)
      setSelected(s.mode)
    } catch {
      toast({
        title: 'Não foi possível carregar o modo de envio',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (!status || selected === status.mode) return
    setSaving(true)
    try {
      const res = await adminService.setEmailDeliveryMode(selected)
      setStatus((prev) =>
        prev ? { ...prev, mode: res.mode, resend_key_configured: res.resend_key_configured } : prev,
      )
      toast({
        title: 'Modo de envio atualizado',
        description: res.warning || res.message,
        variant: res.warning ? 'destructive' : 'default',
      })
      void load()
    } catch {
      toast({
        title: 'Erro ao salvar o modo de envio',
        description: 'Nenhuma alteração foi aplicada. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const modeChanged = !!status && selected !== status.mode

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Mail className="w-5 h-5 text-brand-petrol" />
          Modo de envio de e-mail
        </CardTitle>
        <CardDescription className="text-sm text-slate-500">
          Caminho duplo com contingência: os e-mails (sistema e cobrança) usam sempre os mesmos
          templates Consciente. Se o Resend falhar ou não estiver configurado, o envio cai
          automaticamente no caminho Plataforma — nenhum e-mail se perde.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Carregando modo ativo...
          </div>
        ) : (
          <>
            {/* Indicador do modo ativo atual */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">Modo ativo agora:</span>
              <Badge
                className={cn(
                  'font-medium border',
                  status?.mode === 'platform'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200',
                )}
              >
                {status?.mode === 'platform' ? (
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <Mail className="w-3.5 h-3.5 mr-1" />
                )}
                {status ? MODE_LABEL[status.mode] : '—'}
              </Badge>
              <span className="text-xs text-slate-400">
                remetente: {status?.sender_address || '—'}
              </span>
            </div>

            {status?.mode === 'platform' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                Caminho nativo da plataforma Skip (remetente noreply@mail.goskip.dev) — comprovado
                funcionando. Use como contingência enquanto o domínio próprio não está configurado.
              </div>
            )}
            {status?.mode === 'resend' && !status?.resend_key_configured && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  RESEND_API_KEY ainda não configurada no painel. Os e-mails continuam saindo
                  automaticamente pelo caminho Plataforma até a chave ser salva.
                </span>
              </div>
            )}

            {/* Seletor de modo */}
            <div className="space-y-2">
              <Label htmlFor="email-delivery-mode" className="text-sm font-medium text-slate-700">
                Alternar modo de envio
              </Label>
              <select
                id="email-delivery-mode"
                value={selected}
                onChange={(e) => setSelected(e.target.value as DeliveryMode)}
                disabled={saving}
                className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-petrol/40"
              >
                <option value="platform">Plataforma (contingência)</option>
                <option value="resend">Resend (domínio próprio)</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !modeChanged}
                className="bg-brand-petrol hover:bg-brand-petrol/90 text-white"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar modo de envio
              </Button>
              {modeChanged && (
                <span className="text-xs text-amber-600">
                  Alteração pendente — clique em salvar para aplicar.
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
