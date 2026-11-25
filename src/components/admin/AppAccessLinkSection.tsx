import { useEffect, useState } from 'react'
import { adminService, type AppAccessLinkStatus } from '@/services/finance'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { Globe, Loader2, Save } from 'lucide-react'

// v0.0.177 — Card "Link de Acesso ao App": configuração editável pela dona
// (app_settings key='app_access_link'). O webhook do WhatsApp lê este valor
// EM RUNTIME a cada mensagem — alterar aqui muda o link usado pelo bot sem
// novo deploy.
export function AppAccessLinkSection() {
  const { toast } = useToast()
  const [status, setStatus] = useState<AppAccessLinkStatus | null>(null)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const s = await adminService.getAppAccessLink()
        if (!mounted) return
        setStatus(s)
        setValue(s.value || '')
      } catch (err) {
        if (!mounted) return
        toast({
          title: 'Erro ao carregar o link de acesso',
          description: getErrorMessage(err),
          variant: 'destructive',
        })
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [toast])

  const handleSave = async () => {
    const clean = value.trim().replace(/^https?:\/\//i, '')
    if (!clean || clean.indexOf('.') === -1) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um domínio válido (ex.: consciente.goskip.app).',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await adminService.setAppAccessLink(clean)
      setStatus((prev) => (prev ? { ...prev, value: res.value, source: 'app_settings' } : prev))
      setValue(res.value)
      toast({
        title: 'Link atualizado',
        description: res.message || 'O bot do WhatsApp já usa o novo link nas próximas mensagens.',
      })
    } catch (err) {
      toast({
        title: 'Erro ao salvar o link',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-terracotta" />
            Link de Acesso ao App
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Endereço único informado pela IA no WhatsApp (acessar, logar ou se cadastrar). A
            alteração vale na hora — o bot lê este valor a cada mensagem, sem novo deploy.
          </p>
        </div>
        {status && (
          <span className="text-xs text-slate-400 whitespace-nowrap pt-1">
            {status.source === 'app_settings' ? 'Configuração ativa' : 'Valor padrão (fallback)'}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="app-access-link-input" className="text-sm font-medium text-slate-700">
            Domínio de acesso
          </Label>
          <Input
            id="app-access-link-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="consciente.goskip.app"
            autoComplete="off"
            disabled={loading || saving}
          />
        </div>
        <Button onClick={handleSave} disabled={loading || saving} className="sm:mb-0">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  )
}
