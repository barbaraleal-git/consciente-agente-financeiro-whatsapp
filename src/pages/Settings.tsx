import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import { whatsappService, type WhatsAppStatus } from '@/services/finance'
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
  Globe,
  Loader2,
  CheckCircle2,
  QrCode,
  Smartphone,
} from 'lucide-react'

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()

  // Profile Form
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // WhatsApp connection state
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isWaConnected, setIsWaConnected] = useState(false)
  const [savingWa, setSavingWa] = useState(false)

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

    whatsappService.getStatus().then((status) => {
      if (status) {
        setWhatsappStatus(status)
        setIsWaConnected(status.connected)
        setPhoneNumber(status.phone_number || '')
      }
    })
  }, [user])

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

      {/* WhatsApp Connection */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            Conexão WhatsApp AI
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Vincule seu número para registrar custos através de mensagens de texto e áudio
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isWaConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-slate-900">
                    {phoneNumber || '+55 (11) 98765-4321'}
                  </h4>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      isWaConnected
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isWaConnected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isWaConnected
                    ? 'Recebendo comandos diários de custos e perguntas'
                    : 'Conecte para habilitar atendimento automático no WhatsApp'}
                </p>
              </div>
            </div>

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
                'Desconectar'
              ) : (
                'Conectar WhatsApp'
              )}
            </Button>
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">Comandos suportados no WhatsApp:</p>
            <p>• "Almoço 35 reais" → Cria transação na categoria Alimentação</p>
            <p>• "Uber 22,50" → Registra despesa em Transporte</p>
            <p>
              • "Quanto gastei este mês?" → O agente responde com saldo e relatório em tempo real
            </p>
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
            Avisos de estouro de orçamento e padrões de exibição
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
                  Alertas de Orçamento por WhatsApp
                </p>
                <p className="text-[11px] text-slate-400">
                  Aviso automático ao atingir 80% e 90% do limite estipulado
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
