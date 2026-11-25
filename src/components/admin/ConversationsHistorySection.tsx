import React, { useEffect, useState } from 'react'
import {
  adminService,
  AdminWhatsappConversation,
  AdminAppAssistantConversation,
} from '@/services/finance'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  MessageSquare,
  RefreshCw,
  Sparkles,
  Search,
  ChevronDown,
  ChevronRight,
  Phone,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'
import { getBackendErrorMessage } from '@/lib/pocketbase/errors'

type Space = 'whatsapp' | 'assistant'

interface ConversationListProps {
  space: Space
}

const ConversationBubble: React.FC<{
  m: { id: string; direction: string; message_text: string; created: string }
}> = ({ m }) => {
  const isIncoming = m.direction === 'incoming'
  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg text-xs leading-relaxed ${
          isIncoming
            ? 'bg-white border border-slate-200 text-slate-800 shadow-sm'
            : 'bg-emerald-600 text-white'
        }`}
      >
        <div className="font-semibold mb-1 opacity-75">
          {isIncoming ? 'Cliente' : 'Consciente (Agente)'} • {formatDate(m.created)}
        </div>
        <div className="whitespace-pre-wrap">{m.message_text}</div>
      </div>
    </div>
  )
}

const ConversationMessages: React.FC<{
  messages: Array<{ id: string; direction: string; message_text: string; created: string }>
}> = ({ messages }) => {
  if (messages.length === 0) {
    return (
      <div className="py-6 text-center text-slate-500 text-xs">
        Nenhuma mensagem registrada nesta conversa.
      </div>
    )
  }
  return (
    <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
      {messages.map((m) => (
        <ConversationBubble key={m.id} m={m} />
      ))}
    </div>
  )
}

/** Lista de conversas de UMA origem (espaço exclusivo — nunca mistura os fluxos). */
const ConversationList: React.FC<ConversationListProps> = ({ space }) => {
  const [conversations, setConversations] = useState<
    Array<AdminWhatsappConversation | AdminAppAssistantConversation>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openConvId, setOpenConvId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res =
        space === 'whatsapp'
          ? await adminService.getWhatsappConversations()
          : await adminService.getAppAssistantConversations()
      setConversations(res.conversations)
    } catch (err) {
      setError(getBackendErrorMessage(err, 'Falha ao carregar conversas. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space])

  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const name =
      space === 'whatsapp'
        ? (c as AdminWhatsappConversation).contact_name || c.user?.name || ''
        : c.user?.name || ''
    const email = c.user?.email || ''
    const phone = space === 'whatsapp' ? (c as AdminWhatsappConversation).phone_number || '' : ''
    return (
      name.toLowerCase().includes(q) ||
      email.toLowerCase().includes(q) ||
      phone.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <p className="text-xs text-slate-500 max-w-xl">
          {space === 'whatsapp'
            ? 'Somente conversas vindas do WhatsApp (bot). Quem usou apenas o Assistente dentro do app NÃO aparece aqui.'
            : 'Somente conversas do Assistente DENTRO do app. Contatos do fluxo WhatsApp NÃO aparecem aqui.'}
        </p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200"
              aria-label={
                space === 'whatsapp'
                  ? 'Buscar conversas WhatsApp'
                  : 'Buscar conversas do Assistente'
              }
            />
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2 shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center items-center text-slate-500 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
          Carregando conversas...
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-rose-600 border border-rose-200 bg-rose-50 rounded-lg">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500 border border-slate-200 rounded-lg">
          {search
            ? 'Nenhuma conversa encontrada com os filtros atuais.'
            : space === 'whatsapp'
              ? 'Nenhuma conversa WhatsApp registrada ainda.'
              : 'Nenhuma conversa do Assistente (dentro do app) registrada ainda.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isWa = space === 'whatsapp'
            const wa = c as AdminWhatsappConversation
            const convKey = isWa
              ? wa.contact_id
              : (c as AdminAppAssistantConversation).conversation_id
            const title = isWa
              ? wa.contact_name || c.user?.name || wa.phone_number || 'Contato'
              : c.user?.name || c.user?.email || 'Usuário do app'
            const subtitle = isWa
              ? `${wa.phone_number || 'Sem número'}${wa.user?.email ? ' • ' + wa.user.email : ''}`
              : c.user?.email || ''
            const isOpen = openConvId === convKey
            const lastAt = isWa
              ? wa.last_message_at || ''
              : c.messages.length > 0
                ? c.messages[c.messages.length - 1].created
                : (c as AdminAppAssistantConversation).created || ''
            return (
              <div key={convKey} className="border border-slate-200 rounded-lg bg-white">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenConvId(isOpen ? null : convKey)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`p-2 rounded-lg shrink-0 ${
                        isWa
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-brand-petrol/10 text-brand-petrol'
                      }`}
                    >
                      {isWa ? <Phone className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate">{title}</div>
                      <div className="text-xs text-slate-500 truncate">{subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="bg-slate-50 text-slate-600 border-slate-200 text-xs"
                    >
                      {c.messages.length} msg
                    </Badge>
                    {lastAt && (
                      <span className="text-[11px] text-slate-400 hidden sm:block">
                        {formatDate(lastAt)}
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5">
                    <ConversationMessages messages={c.messages} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * v0.0.176 — Dois espaços de histórico mutuamente exclusivos (decisão da dona):
 * "Conversas WhatsApp" (contatos do bot) e "Conversas do Assistente" (threads
 * usadas dentro do app). A exclusão cruzada é aplicada NO BACKEND.
 */
export const ConversationsHistorySection: React.FC = () => {
  const [space, setSpace] = useState<Space>('whatsapp')

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="p-4 sm:p-6 pb-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-petrol" />
          <CardTitle className="text-lg font-bold text-slate-900">Histórico de Conversas</CardTitle>
        </div>
        <CardDescription className="text-sm text-slate-500 mt-1">
          Dois espaços separados por origem: WhatsApp (bot) e Assistente dentro do app — nunca
          misturados.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <Tabs value={space} onValueChange={(v) => setSpace(v as Space)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <Phone className="w-4 h-4" />
              Conversas WhatsApp
            </TabsTrigger>
            <TabsTrigger value="assistant" className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              Conversas do Assistente
            </TabsTrigger>
          </TabsList>
          <TabsContent value="whatsapp" className="mt-0">
            <ConversationList space="whatsapp" />
          </TabsContent>
          <TabsContent value="assistant" className="mt-0">
            <ConversationList space="assistant" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
