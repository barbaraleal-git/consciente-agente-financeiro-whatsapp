import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { EyeClosedIcon } from '@/components/icons/EyeClosedIcon'
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
  Key,
  Eye,
  Send,
  HelpCircle,
  Mic,
  Camera,
  Upload,
  Info,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Profile Form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [userPhone, setUserPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // WhatsApp connection state
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isWaConnected, setIsWaConnected] = useState(false)
  const [savingWa, setSavingWa] = useState(false)
  const [liveStatus, setLiveStatus] = useState<WhatsAppLiveStatus | null>(null)
  const [loadingLiveStatus, setLoadingLiveStatus] = useState(false)
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])

  // Meta Permanent Access Token state
  const [metaTokenInput, setMetaTokenInput] = useState('')
  const [showMetaToken, setShowMetaToken] = useState(false)
  const [savingMetaToken, setSavingMetaToken] = useState(false)

  // STT Transcription API Key state (Groq / OpenAI)
  const [sttKeyInput, setSttKeyInput] = useState('')
  const [showSttKey, setShowSttKey] = useState(false)
  const [savingSttKey, setSavingSttKey] = useState(false)

  // WhatsApp Profile Picture state (ITEM 20)
  const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null)
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null)
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false)

  // Test simulation & Direct message test
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('Almoço no restaurante 45 reais')
  const [testSenderName, setTestSenderName] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [sendingDirectTest, setSendingDirectTest] = useState(false)
  const [testResult, setTestResult] = useState<{
    reply: string
    is_registered: boolean
    user_name: string
    remote_sent?: boolean
    remote_error?: string | null
  } | null>(null)
  // Notification toggles
  const [waNotifications, setWaNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)

  // Password Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Email Change Modal
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmailChange, setSavingEmailChange] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.email === 'barbara.ferreira.leal@gmail.com'

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
      setUserPhone(user.phone || '')
    } else {
      setName('')
      setEmail('')
    }

    if (isAdmin) {
      loadAllWhatsAppInfo()
    }
  }, [user, isAdmin])

  const loadAllWhatsAppInfo = async () => {
    if (!isAdmin) return
    setLoadingLiveStatus(true)
    try {
      const status = await whatsappService.getStatus().catch(() => null)
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
    } catch {
      /* cliente comum não tem acesso */
    } finally {
      setLoadingLiveStatus(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    setSavingProfile(true)
    try {
      const cleanPhone = userPhone.replace(/\D/g, '')
      await pb.collection('users').update(user.id, {
        name: name.trim(),
        phone: cleanPhone,
      })
      // Se tiver contato em whatsapp_contacts com esse telefone, vincula
      if (cleanPhone) {
        try {
          await whatsappService.linkContact(undefined, cleanPhone)
        } catch {
          /* intentionally ignored */
        }
      }
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
        phoneNumber || '+55 11 94998-9868',
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

  const handleSaveMetaToken = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanToken = metaTokenInput.trim()
    if (!cleanToken) {
      toast({
        title: 'Token vazio',
        description: 'Cole o Token de Acesso da Meta antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    setSavingMetaToken(true)
    try {
      const res = await whatsappService.saveMetaToken(cleanToken)
      toast({
        title: 'Token Meta Salvo!',
        description: res.message || 'Token Permanente configurado com sucesso para envios diretos.',
      })
      setMetaTokenInput('')
      setShowMetaToken(false)
      await loadAllWhatsAppInfo()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar o token da Meta'
      toast({
        title: 'Erro ao salvar token',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSavingMetaToken(false)
    }
  }

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Valida tipo e extensão de forma abrangente e tolerante
    const mime = (file.type || '').toLowerCase()
    const name = (file.name || '').toLowerCase()
    const isJpegOrPng =
      mime.includes('jpeg') ||
      mime.includes('jpg') ||
      mime.includes('png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.png')

    if (!isJpegOrPng) {
      toast({
        title: 'Formato não suportado',
        description: `O arquivo selecionado (${file.name || 'desconhecido'}) não é JPEG ou PNG. Selecione uma imagem .jpg, .jpeg ou .png.`,
        variant: 'destructive',
      })
      return
    }

    // Valida tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Imagem muito pesada',
        description: `O tamanho do arquivo (${(file.size / (1024 * 1024)).toFixed(2)} MB) ultrapassa o limite de 5MB permitido pela Meta.`,
        variant: 'destructive',
      })
      return
    }

    setSelectedProfileImage(file)
    const previewUrl = URL.createObjectURL(file)
    setProfileImagePreview(previewUrl)
  }

  const handleUploadProfilePicture = async () => {
    if (!selectedProfileImage) {
      toast({
        title: 'Nenhuma foto selecionada',
        description: 'Escolha uma imagem antes de clicar em atualizar.',
        variant: 'destructive',
      })
      return
    }

    setUploadingProfilePicture(true)
    try {
      const res = await whatsappService.updateProfilePicture(selectedProfileImage)
      if (res.success) {
        toast({
          title: 'Foto Atualizada com Sucesso!',
          description:
            res.message ||
            'Foto atualizada com sucesso — pode levar alguns minutos para aparecer para os clientes no WhatsApp.',
        })
        setSelectedProfileImage(null)
        setProfileImagePreview(null)
        await loadAllWhatsAppInfo()
      } else {
        // Se a resposta retornou success: false com erro da Meta detalhado
        toast({
          title: 'A Meta recusou a foto',
          description: res.error || 'A Meta rejeitou a imagem de perfil enviada.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao atualizar foto de perfil do WhatsApp'
      toast({
        title: 'Erro ao atualizar foto',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setUploadingProfilePicture(false)
    }
  }

  const handleSaveSttKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanKey = sttKeyInput.trim()
    if (!cleanKey) {
      toast({
        title: 'Chave vazia',
        description: 'Cole a Chave de Transcrição (Groq ou OpenAI) antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    setSavingSttKey(true)
    try {
      const res = await whatsappService.saveSttKey(cleanKey)
      toast({
        title: 'Chave de Transcrição Salva!',
        description:
          res.message ||
          'Chave de voz configurada com sucesso para converter áudios do WhatsApp em texto.',
      })
      setSttKeyInput('')
      setShowSttKey(false)
      await loadAllWhatsAppInfo()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar a chave de transcrição'
      toast({
        title: 'Erro ao salvar chave STT',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSavingSttKey(false)
    }
  }

  const handleSendDirectTest = async () => {
    const target = testPhone || liveStatus?.owner_phone || '+5511949989868'
    setSendingDirectTest(true)
    try {
      const res = await whatsappService.sendTestMessage(
        target,
        'Olá! Teste de envio direto pela WhatsApp Cloud API oficial da Meta configurado com sucesso no Consciente - Seu parceiro nas finanças!',
      )
      if (res.success) {
        toast({
          title: 'Mensagem Enviada!',
          description: `Disparo confirmado pela Meta Cloud API para ${target}. Verifique seu WhatsApp!`,
        })
      } else {
        toast({
          title: res.missing_token ? 'Token Meta não configurado' : 'Erro no envio pela Meta',
          description: res.error || 'A Meta rejeitou a mensagem.',
          variant: 'destructive',
        })
      }
      await loadAllWhatsAppInfo()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no disparo de teste'
      toast({
        title: 'Erro ao testar envio',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSendingDirectTest(false)
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
        true,
      )
      setTestResult({
        reply: res.reply,
        is_registered: res.is_registered,
        user_name: res.user_name,
        remote_sent: res.remote_sent,
        remote_error: res.remote_error,
      })
      toast({
        title: 'Mensagem processada com sucesso!',
        description: res.is_registered
          ? `Transação vinculada à conta de ${res.user_name}. Resposta gerada!`
          : 'Número visitante atendido com apresentação e convite.',
      }) // Atualiza contatos
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
                  name="user_full_name"
                  autoComplete="off"
                  placeholder="Seu nome completo"
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
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Alterar
                  </button>
                </div>
                <Input
                  id="pEmail"
                  name="user_email_address"
                  autoComplete="off"
                  value={email}
                  disabled
                  className="bg-slate-100 border-slate-200 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pPhone" className="text-xs font-medium text-slate-700">
                    WhatsApp Vinculado ao seu Perfil
                  </Label>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Número que conversa com o agente
                  </span>
                </div>
                <Input
                  id="pPhone"
                  name="user_phone_number"
                  placeholder="Ex: 5511976729458 ou (11) 97672-9458"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="bg-slate-50 border-slate-200 text-sm font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Cadastre seu número com DDD (com ou sem 55). Toda mensagem enviada deste WhatsApp
                  será automaticamente registrada nas suas caixinhas.
                </p>
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

      {/* WhatsApp Connection Real & Owner - VISÍVEL APENAS PARA ADMINISTRADORES */}
      {isAdmin && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Canal Oficial WhatsApp Business (Meta Cloud API)
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-100 text-slate-700 border-slate-300"
                  >
                    Apenas Admin
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Integração da conta de WhatsApp Business do dono com o Consciente - Seu parceiro
                  nas finanças
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTestModalOpen(true)}
                  className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium"
                >
                  <PlayCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Testar Mensagem
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Status do Canal & Número Registrado */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-slate-900">
                        {liveStatus?.owner_phone || phoneNumber || '+55 11 94998-9868'}
                      </h4>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                      >
                        Número Meta Oficial
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${
                          liveStatus?.token_configurado
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300'
                        }`}
                      >
                        {liveStatus?.token_configurado
                          ? 'Token Meta Configurado'
                          : 'Token Meta Pendente'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${
                          liveStatus?.stt_configurado
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {liveStatus?.stt_configurado
                          ? 'Transcrição de Áudio Ativa ✓'
                          : 'Transcrição de Áudio Pendente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Número oficial de atendimento pelo WhatsApp (
                      {liveStatus?.app_name || 'Consciente'})
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

              {/* Detalhes da Meta Cloud API (Phone ID, WABA ID, App) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Identificação do Número (Phone ID)
                  </span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-xs font-mono font-semibold text-slate-800">
                      {liveStatus?.phone_number_id || '1314873981716321'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          liveStatus?.phone_number_id || '1314873981716321',
                        )
                        toast({ title: 'Copiado', description: 'Phone Number ID copiado.' })
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    WABA ID (Messaging Account)
                  </span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-xs font-mono font-semibold text-slate-800">
                      {liveStatus?.waba_id || '1888947369148112'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(liveStatus?.waba_id || '1888947369148112')
                        toast({ title: 'Copiado', description: 'WABA ID copiado.' })
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Nome do Aplicativo Meta
                  </span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {liveStatus?.app_name || 'Consciente'}
                    </span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      Produção
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Status do canal */}
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  Envio e Recebimento via WhatsApp Cloud API Oficial da Meta
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  As mensagens enviadas no WhatsApp para <strong>+55 11 94998-9868</strong> chegam
                  diretamente no webhook do agente. As respostas agora são enviadas{' '}
                  <strong>diretamente pela WhatsApp Cloud API oficial da Meta</strong>{' '}
                  (graph.facebook.com), sem depender de conectores externos.
                </p>
                {liveStatus?.last_send_error && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] mt-1.5">
                    <strong>Último status de envio:</strong> {liveStatus.last_send_error}
                  </div>
                )}
              </div>

              {/* Configuração do Token Permanente da Meta */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-600" />
                      Token de Acesso da WhatsApp Cloud API (Meta)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cole o Token de Acesso do Usuário do Sistema da Meta (ou token de acesso da
                      Cloud API) para autorizar o envio direto de mensagens aos clientes.
                    </p>
                  </div>
                  {liveStatus?.token_configurado ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0"
                    >
                      <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                      Token Ativo
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                      Não configurado
                    </Badge>
                  )}
                </div>

                <form onSubmit={handleSaveMetaToken} className="space-y-2 pt-1">
                  <Label htmlFor="metaToken" className="text-[11px] font-medium text-slate-600">
                    {liveStatus?.token_configurado
                      ? 'Substituir / Atualizar Token da Meta'
                      : 'Colar Token da Meta'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="metaToken"
                        type={showMetaToken ? 'text' : 'password'}
                        placeholder={
                          liveStatus?.token_configurado
                            ? '•••••••••••••••••••••••••••••••••••••••• (Token já salvo com segurança)'
                            : 'EAAB... (Cole seu token aqui)'
                        }
                        value={metaTokenInput}
                        onChange={(e) => setMetaTokenInput(e.target.value)}
                        className="pr-9 font-mono text-xs bg-slate-50 border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMetaToken(!showMetaToken)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                        aria-label={showMetaToken ? 'Ocultar token' : 'Mostrar token'}
                      >
                        {showMetaToken ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeClosedIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingMetaToken || !metaTokenInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs shrink-0"
                    >
                      {savingMetaToken ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Token'
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      Onde pegar: <strong>developers.facebook.com</strong> → Seu App (
                      {liveStatus?.app_name || 'Consciente'}) → WhatsApp → Configuração da API (ou
                      Configurações do Negócio → Usuários do Sistema).
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSendDirectTest}
                      disabled={sendingDirectTest || !liveStatus?.token_configurado}
                      className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-7 text-[11px] font-medium"
                    >
                      {sendingDirectTest ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Send className="w-3 h-3 mr-1" />
                      )}
                      Testar Disparo Direto
                    </Button>
                  </div>
                </form>
              </div>

              {/* Configuração da Chave de Transcrição de Voz (STT API Key - Groq / OpenAI) */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-indigo-600" />
                      Chave de Transcrição de Voz / STT (Groq / OpenAI)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chave de transcrição de voz (Groq/OpenAI) para converter áudios do WhatsApp em
                      texto automaticamente. Recomendamos Groq Whisper Large v3 (gratuito e
                      ultrarrápido).
                    </p>
                  </div>
                  {liveStatus?.stt_configurado ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0"
                    >
                      <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                      Chave de transcrição configurada ✓
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                    >
                      <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                      Não configurada
                    </Badge>
                  )}
                </div>

                <form onSubmit={handleSaveSttKey} className="space-y-2 pt-1">
                  <Label htmlFor="sttKey" className="text-[11px] font-medium text-slate-600">
                    {liveStatus?.stt_configurado
                      ? 'Substituir / Atualizar Chave de Transcrição'
                      : 'Colar Chave de Transcrição (Groq ou OpenAI)'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="sttKey"
                        type={showSttKey ? 'text' : 'password'}
                        placeholder={
                          liveStatus?.stt_configurado
                            ? '•••••••••••••••••••••••••••••••••••••••• (Chave salva com segurança no banco)'
                            : 'gsk_... ou sk-... (Cole sua chave de STT aqui)'
                        }
                        value={sttKeyInput}
                        onChange={(e) => setSttKeyInput(e.target.value)}
                        className="pr-9 font-mono text-xs bg-slate-50 border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSttKey(!showSttKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                        aria-label={showSttKey ? 'Ocultar chave' : 'Mostrar chave'}
                      >
                        {showSttKey ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeClosedIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingSttKey || !sttKeyInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs shrink-0"
                    >
                      {savingSttKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Chave'
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      Onde pegar chave gratuita: <strong>console.groq.com/keys</strong> (modelo
                      Whisper Large v3) ou plataforma OpenAI (platform.openai.com). O valor nunca é
                      exibido na tela após salvo.
                    </span>
                  </div>
                </form>
              </div>
            </div>
            {/* Foto do Perfil do WhatsApp via API Oficial da Meta (ITEM 20) */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs space-y-3.5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                      Foto de Perfil do WhatsApp via API
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-medium"
                      >
                        Meta Resumable Upload
                      </Badge>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Atualize a imagem exibida para os clientes no WhatsApp diretamente pela API da
                      Meta
                    </p>
                  </div>
                </div>
              </div>

              {/* Nota Explicativa Crítica: Nome de exibição vs Foto de perfil */}
              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-950">
                    Aviso sobre o Nome de Exibição do WhatsApp:
                  </p>
                  <p className="text-amber-800 leading-relaxed">
                    O <strong>nome de exibição</strong> que aparece para os clientes{' '}
                    <strong>não pode ser alterado via API</strong> por restrição oficial da Meta —
                    ele exige análise e aprovação humana no{' '}
                    <a
                      href="https://business.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-semibold hover:text-amber-950 inline-flex items-center"
                    >
                      WhatsApp Manager
                    </a>{' '}
                    (Gerenciador de Negócios → Contas do WhatsApp → Números de telefone → Perfil).
                    Já a <strong>foto de perfil</strong> pode ser trocada e atualizada diretamente
                    aqui pelo botão abaixo!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] items-center gap-4 pt-1">
                {/* Preview da foto */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative group">
                    {profileImagePreview ? (
                      <img
                        src={profileImagePreview}
                        alt="Pré-visualização da foto"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <Camera className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <span className="text-[9px] block">Sem foto</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">JPEG ou PNG (máx. 5MB)</span>
                </div>

                {/* Ações de seleção e envio */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleProfileImageChange}
                        disabled={uploadingProfilePicture}
                        className="hidden"
                      />
                      <span className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                        <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                        {selectedProfileImage ? 'Trocar Imagem...' : 'Escolher Imagem...'}
                      </span>
                    </label>

                    {selectedProfileImage && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={uploadingProfilePicture}
                        onClick={handleUploadProfilePicture}
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                      >
                        {uploadingProfilePicture ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            Enviando para a Meta...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                            Atualizar Foto via API
                          </>
                        )}
                      </Button>
                    )}

                    {selectedProfileImage && !uploadingProfilePicture && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProfileImage(null)
                          setProfileImagePreview(null)
                        }}
                        className="h-8 text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>

                  {selectedProfileImage && (
                    <p className="text-[11px] text-slate-600 font-mono truncate max-w-md">
                      Arquivo: <strong>{selectedProfileImage.name}</strong> (
                      {(selectedProfileImage.size / 1024).toFixed(1)} KB)
                    </p>
                  )}

                  <p className="text-[11px] text-slate-400">
                    O envio utiliza a sessão Resumable Upload da Meta e aplica a foto no número de
                    WhatsApp oficial com autenticação protegida.
                  </p>
                </div>
              </div>
            </div>
            {/* Webhook URLs prontas para o painel da Meta */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
              <div>
                <span className="font-semibold text-slate-800 block">
                  Configuração de Webhook na Meta (developers.facebook.com)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cole esta URL no campo <strong>URL de Retorno de Chamada</strong> do painel da
                  Meta e configure o Token de Verificação.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-600">
                  URL de Retorno de Chamada do Webhook
                </Label>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] bg-white px-2.5 py-2 rounded-lg border border-slate-200 text-slate-800 font-mono flex-1 truncate select-all">
                    {liveStatus?.webhook_url ||
                      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/webhook`}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-100"
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
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-[11px] font-medium text-slate-600">
                  Token de Verificação (hub.verify_token)
                </Label>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] bg-white px-2.5 py-1.5 rounded border border-slate-200 text-slate-800 font-mono flex-1 truncate select-all">
                    {liveStatus?.verify_token || 'agente-financeiro'}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-slate-600 hover:text-slate-900"
                    onClick={() => {
                      navigator.clipboard.writeText(liveStatus?.verify_token || 'agente-financeiro')
                      toast({
                        title: 'Copiado',
                        description: 'Token de verificação copiado.',
                      })
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
            {/* Lista de Contatos do WhatsApp que interagiram */}{' '}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Clientes e Números que Conversaram com o Agente ({contacts.length})
                </h4>
              </div>

              {contacts.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-slate-100">
                  Nenhum número interagiu ainda. Use o botão "Testar Mensagem" para simular a
                  primeira conversa.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white max-h-48 overflow-y-auto">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 text-xs flex items-center justify-between gap-2"
                    >
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
      )}

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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/release/log')}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Ver Notas de Versão (/release/log)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/onboarding')}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 text-xs sm:text-sm shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Refazer onboarding das caixinhas
            </Button>
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
              <div className="relative">
                <Input
                  type={showOldPassword ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showOldPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showOldPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeClosedIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Nova Senha (mín. 8)</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showNewPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeClosedIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirmPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeClosedIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
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
              cadastrado ou visitante, aciona o Consciente com as ferramentas de caixinhas e gera a
              resposta.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRunSimulation} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Número do Telefone</Label>
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+55 11 94998-9868"
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
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Resposta do Consciente:</span>
                  <div className="flex items-center gap-1.5">
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
                    {testResult.remote_sent ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Enviado via Meta Cloud API
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-slate-100 text-slate-600 border-slate-200"
                      >
                        Simulação Interna
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-2.5 rounded border border-slate-100">
                  {testResult.reply}
                </p>
                {testResult.remote_error && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                    Status do envio pela Meta: {testResult.remote_error}
                  </p>
                )}
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
