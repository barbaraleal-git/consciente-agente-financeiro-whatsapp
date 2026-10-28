import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import {
  whatsappService,
  type WhatsAppStatus,
  type WhatsAppLiveStatus,
  type WhatsAppContact,
} from '@/services/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  User,
  MessageSquare,
  Bell,
  Lock,
  Loader2,
  Smartphone,
  Sparkles,
  PiggyBank,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  Copy,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Profile Form
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // WhatsApp connection state
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isWaConnected, setIsWaConnected] = useState(false)
  const [savingWa, setSavingWa] = useState(false)
  const [liveStatus, setLiveStatus] = useState<WhatsAppLiveStatus | null>(null)
  const [loadingLiveStatus, setLoadingLiveStatus] = useState(false)
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])

  // Test simulation
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('Almoço no restaurante 45 reais')
  const [testSenderName, setTestSenderName] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    reply: string
    is_registered: boolean
    user_name: string
  } | null>(null)

  // Notification toggles
  const [waNotifications, setWaNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)

  // Password Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Email Change Modal
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmailChange, setSavingEmailChange] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
    }

    loadAllWhatsAppInfo()
  }, [user])

  const loadAllWhatsAppInfo = async () => {
    setLoadingLiveStatus(true)
    try {
      const status = await whatsappService.getStatus()
      if (status) {
        setWhatsappStatus(status)
        setIsWaConnected(status.connected)
        setPhoneNumber(status.phone_number || '')
        if (!testPhone) setTestPhone(status.phone_number || '')
      }

      const live = await whatsappService.getLiveStatus().catch(() => null)
      if (live) {
        setLiveStatus(live)
      }

      const contactList = await whatsappService.listContacts().catch(() => [])
      setContacts(contactList)
    } finally {
      setLoadingLiveStatus(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSavingProfile(true)
    try {
      await pb.collection('users').update(user.id, {
        name: name.trim(),
      })
      await refreshUser()
      toast({ title: 'Perfil atualizado', description: 'Dados cadastrais salvos com sucesso.' })
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleToggleWhatsApp = async () => {
    setSavingWa(true)
    try {
      const nextState = !isWaConnected
      const updated = await whatsappService.updateStatus(
        nextState,
        phoneNumber || '+55 (11) 98765-4321',
      )
      setIsWaConnected(updated.connected)
      setPhoneNumber(updated.phone_number || '')
      await loadAllWhatsAppInfo()
      toast({
        title: updated.connected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado',
        description: updated.connected
          ? 'O número foi sincronizado para receber e registrar despesas diárias.'
          : 'O canal do WhatsApp foi desconectado.',
      })
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a conexão.',
        variant: 'destructive',
      })
    } finally {
      setSavingWa(false)
    }
  }

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testPhone || !testMessage) return

    setTestLoading(true)
    try {
      const res = await whatsappService.simulateMessage(
        testPhone,
        testMessage,
        testSenderName || user?.name || 'Cliente',
      )
      setTestResult({
        reply: res.reply,
        is_registered: res.is_registered,
        user_name: res.user_name,
      })
      toast({
        title: 'Mensagem processada pelo agente!',
        description: res.is_registered
          ? `Transação vinculada com sucesso à conta de ${res.user_name}.`
          : 'Número visitante atendido com apresentação e convite.',
      })
      // Atualiza contatos
      const contactList = await whatsappService.listContacts().catch(() => [])
      setContacts(contactList)
      window.dispatchEvent(new Event('finance-refresh'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha na simulação'
      toast({
        title: 'Erro no teste',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setTestLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (newPassword.length < 8) {
      toast({
        title: 'Senha curta',
        description: 'A nova senha deve ter no mínimo 8 caracteres.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não coincidem',
        description: 'A confirmação não confere com a nova senha.',
        variant: 'destructive',
      })
      return
    }

    setSavingPassword(true)
    try {
      await pb.collection('users').update(user.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm: confirmPassword,
      })
      toast({ title: 'Senha alterada', description: 'Sua senha foi redefinida com sucesso.' })
      setPasswordModalOpen(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      toast({
        title: 'Erro ao alterar',
        description: 'A senha atual informada está incorreta.',
        variant: 'destructive',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newEmail.includes('@')) return

    setSavingEmailChange(true)
    try {
      await pb.collection('users').requestEmailChange(newEmail)
      toast({
        title: 'Confirmação enviada',
        description: `Enviamos um link de confirmação para ${newEmail}. Acesse seu email para concluir a alteração.`,
      })
      setEmailModalOpen(false)
      setNewEmail('')
    } catch {
      toast({
        title: 'Erro ao solicitar',
        description: 'Não foi possível solicitar a troca de email.',
        variant: 'destructive',
      })
    } finally {
      setSavingEmailChange(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">
          Gerencie seu perfil, preferências e a integração com o WhatsApp
        </p>
      </div>

      {/* Perfil */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            Perfil do Usuário
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Informações associadas à sua conta na plataforma
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pName" className="text-xs font-medium text-slate-700">
                  Nome Completo
                </Label>
                <Input
                  id="pName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-50 border-slate-200 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pEmail" className="text-xs font-medium text-slate-700">
                    Email
                  </Label>
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(true)}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Alterar email
                  </button>
                </div>
                <Input
                  id="pEmail"
                  value={email}
                  disabled
                  className="bg-slate-100 border-slate-200 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingProfile}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm"
            >
              {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* WhatsApp Connection Real & Owner */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                WhatsApp do Agente Financeiro (Modo Owner)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Ponte oficial entre o WhatsApp e o agente inteligente com inteligência de caixinhas
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTestModalOpen(true)}
                className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <PlayCircle className="w-3.5 h-3.5 mr-1" />
                Testar Mensagem
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status do Conector Owner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    liveStatus?.owner_connected
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-slate-900">
                      {liveStatus?.owner_phone || phoneNumber || '+55 (11) 98765-4321'}
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        liveStatus?.owner_connected
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {liveStatus?.owner_connected ? 'Número Owner Ativo' : 'Aguardando Permissão'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {liveStatus?.owner_connected
                      ? 'Todas as mensagens enviadas para este número são processadas pelo agente'
                      : 'O conector WhatsApp da conta owner aguarda a confirmação de uso da sua conta'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleToggleWhatsApp}
                  disabled={savingWa}
                  variant={isWaConnected ? 'outline' : 'default'}
                  className={
                    isWaConnected
                      ? 'border-slate-300 text-slate-700 hover:bg-slate-100 text-xs'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs'
                  }
                >
                  {savingWa ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isWaConnected ? (
                    'Desvincular do meu perfil'
                  ) : (
                    'Vincular meu número'
                  )}
                </Button>
              </div>
            </div>

            {/* Banner explicativo de status */}
            {!liveStatus?.owner_connected ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Autorização do Conector Owner WhatsApp
                </div>
                <p>
                  A plataforma Skip requer a confirmação do criador para ativar o toolkit{' '}
                  <strong>whatsapp</strong> com sua conta de dono. O fluxo da ponte, webhook Meta e
                  processamento de mensagens pelo agente já estão 100% prontos no backend!
                </p>
                <p className="text-[11px] text-amber-700 pt-1">
                  Você já pode testar o processamento e respostas pelo botão{' '}
                  <strong>"Testar Mensagem"</strong> acima.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Conector WhatsApp ativo com a conta owner. Clientes conversam em tempo real.
                </span>
              </div>
            )}
          </div>

          {/* Webhook URL para configuração no Meta for Developers */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
            <span className="font-semibold text-slate-700">
              URL do Webhook do WhatsApp (Meta Cloud API):
            </span>
            <div className="flex items-center gap-2">
              <code className="text-[11px] bg-white px-2.5 py-1.5 rounded border border-slate-200 text-slate-700 flex-1 truncate select-all">
                {liveStatus?.webhook_url ||
                  `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/webhook`}
              </code>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-slate-600 hover:text-slate-900"
                onClick={() => {
                  navigator.clipboard.writeText(
                    liveStatus?.webhook_url ||
                      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/webhook`,
                  )
                  toast({
                    title: 'Copiado',
                    description: 'URL do webhook copiada para a área de transferência.',
                  })
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Token de verificação: <code className="bg-white px-1 rounded">agente-financeiro</code>
            </p>
          </div>

          {/* Lista de Contatos do WhatsApp que interagiram */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Clientes e Números que Conversaram com o Agente ({contacts.length})
              </h4>
            </div>

            {contacts.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-slate-100">
                Nenhum número interagiu ainda. Use o botão "Testar Mensagem" para simular a primeira
                conversa.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                {contacts.map((c) => (
                  <div key={c.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {c.name || c.phone_number}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            c.is_registered
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {c.is_registered ? 'Cadastrado no App' : 'Visitante'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tel: {c.phone_number} • {c.messages_count} mensagem(ns)
                      </p>
                    </div>

                    <span className="text-[10px] text-slate-400 shrink-0">
                      {c.last_message_at
                        ? new Date(c.last_message_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Recente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preferências & Notificações */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Notificações & Preferências
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Avisos de estouro das caixinhas e padrões de exibição
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Moeda</span>
              <p className="text-sm font-bold text-slate-800 mt-1">Real Brasileiro (BRL)</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Formato de Data
              </span>
              <p className="text-sm font-bold text-slate-800 mt-1">DD/MM/AAAA (pt-BR)</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Fuso Horário
              </span>
              <p className="text-sm font-bold text-slate-800 mt-1">America/Sao_Paulo (GMT-3)</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Alertas das Caixinhas por WhatsApp
                </p>
                <p className="text-[11px] text-slate-400">
                  Aviso automático ao atingir 80% e 90% do teto da caixinha
                </p>
              </div>
              <Switch checked={waNotifications} onCheckedChange={setWaNotifications} />
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-800">Resumo Semanal por Email</p>
                <p className="text-[11px] text-slate-400">
                  Receba os principais destaques financeiros toda segunda-feira
                </p>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding das Caixinhas */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-indigo-600" />
            Configuração Guiada das Caixinhas
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Deseja reorganizar suas categorias e tetos mensais com auxílio guiado?
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-600 max-w-md">
            Você pode refazer a montagem guiada das suas caixinhas a qualquer momento, escolhendo
            quais categorias controlar e ajustando seus valores mensais.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/onboarding')}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 text-xs sm:text-sm shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Refazer onboarding das caixinhas
          </Button>
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-700" />
            Segurança da Conta
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Gerenciamento de credenciais e proteção
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPasswordModalOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm"
          >
            Alterar Senha de Acesso
          </Button>
        </CardContent>
      </Card>

      {/* Modal Alterar Senha */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Informe sua senha atual e escolha uma nova senha segura.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Senha Atual</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Nova Senha (mín. 8)</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Confirmar Nova Senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordModalOpen(false)}
                disabled={savingPassword}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingPassword}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {savingPassword ? 'Alterando...' : 'Salvar Nova Senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Testar Mensagem do WhatsApp */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-indigo-600" />
              Simular Mensagem Recebida no WhatsApp
            </DialogTitle>
            <DialogDescription>
              Testa a ponte ponta a ponta: o webhook recebe o texto, identifica se o número é
              cadastrado ou visitante, aciona o Agente Financeiro com as ferramentas de caixinhas e
              gera a resposta.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRunSimulation} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Número do Telefone</Label>
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+55 11 98765-4321"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Nome do Contato</Label>
                <Input
                  value={testSenderName}
                  onChange={(e) => setTestSenderName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                Texto enviado pelo cliente no WhatsApp
              </Label>
              <Input
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Ex: Almoço 35 reais ou Como estão minhas caixinhas?"
                required
              />
            </div>

            {testResult && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Resposta do Agente Financeiro:
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      testResult.is_registered
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}
                  >
                    {testResult.is_registered ? 'Conta Reconhecida' : 'Visitante Apresentado'}
                  </Badge>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-2.5 rounded border border-slate-100">
                  {testResult.reply}
                </p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTestModalOpen(false)}
                disabled={testLoading}
              >
                Fechar
              </Button>
              <Button
                type="submit"
                disabled={testLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {testLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Processando...
                  </>
                ) : (
                  'Enviar Mensagem Teste'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Alterar Email */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle>Alterar Email da Conta</DialogTitle>
            <DialogDescription>
              Enviaremos um link de confirmação para o novo endereço digitado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRequestEmailChange} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Novo Endereço de Email</Label>
              <Input
                type="email"
                placeholder="novo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailModalOpen(false)}
                disabled={savingEmailChange}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEmailChange}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {savingEmailChange ? 'Enviando...' : 'Solicitar Troca'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Settings
