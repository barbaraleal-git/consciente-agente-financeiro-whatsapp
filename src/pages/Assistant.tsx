import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import {
  streamAgentChat,
  displayableMessages,
  type AgentCitation,
  type DisplayMessage,
  type AgentMessage,
} from '@/lib/skipAi'
import {
  importJobsService,
  whatsappService,
  type ImportJob,
  type WhatsAppLiveStatus,
} from '@/services/finance'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Bot,
  User,
  Send,
  Loader2,
  UploadCloud,
  FileText,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Smartphone,
} from 'lucide-react'

const SUGGESTIONS = [
  'Resumo dos meus gastos deste mês',
  'Onde posso economizar e cortar custos?',
  'Como está a situação das minhas caixinhas?',
  'Quais categorias consumiram mais dinheiro?',
]

export const Assistant: React.FC = () => {
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.email === 'barbara.ferreira.leal@gmail.com'

  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá! Eu sou o **Consciente - Seu parceiro nas finanças**. Estou integrado à sua conta e posso analisar seus gastos, sugerir cortes, verificar os tetos das suas caixinhas e te ajudar no controle diário de custos. Como posso te auxiliar hoje?',
      created: new Date().toISOString(),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [currentCitations, setCurrentCitations] = useState<AgentCitation[]>([])

  // WhatsApp Status
  const [waLive, setWaLive] = useState<WhatsAppLiveStatus | null>(null)

  // File Upload State (.txt WhatsApp export)
  const [importJobs, setImportJobs] = useState<ImportJob[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  // Load existing import jobs
  const loadImportJobs = async () => {
    try {
      const jobs = await importJobsService.list()
      setImportJobs(jobs)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadImportJobs()
    if (isAdmin) {
      whatsappService
        .getLiveStatus()
        .then(setWaLive)
        .catch(() => null)
    }
  }, [isAdmin])

  // Realtime updates for import jobs
  useRealtime<ImportJob>('import_jobs', (e) => {
    loadImportJobs()
    if (e.action === 'update' && e.record.status === 'done') {
      toast({
        title: 'Histórico importado!',
        description: `${e.record.imported_count} transações foram adicionadas a partir do WhatsApp.`,
      })
      window.dispatchEvent(new Event('finance-refresh'))
    }
  })

  // Handle message sending to Skip Cloud Agent
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText
    if (!text.trim() || isStreaming) return

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      created: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInputText('')
    setIsStreaming(true)
    setStreamingContent('')
    setCurrentCitations([])

    const abortController = new AbortController()

    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          stream: true,
        }),
        signal: abortController.signal,
      })

      const result = await streamAgentChat(res, {
        onChunk: (_delta, full) => {
          setStreamingContent(full)
        },
        onCitations: (c) => {
          setCurrentCitations(c)
        },
        signal: abortController.signal,
      })

      const newConvId = res.headers.get('X-Conversation-Id') || result.conversation_id
      if (newConvId) setConversationId(newConvId)

      const assistantMsg: DisplayMessage = {
        id: result.message_id || `asst-${Date.now()}`,
        role: 'assistant',
        content: result.content,
        citations: result.citations,
        created: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
      setStreamingContent('')
      setCurrentCitations([])
    } catch (err: unknown) {
      console.error('Agent chat error:', err)
      const errorMsg: DisplayMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          'Não consegui processar sua mensagem neste momento. Verifique sua conexão ou tente novamente.',
        created: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  // Handle WhatsApp .txt export file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.txt')) {
      toast({
        title: 'Formato inválido',
        description: 'Envie o arquivo de histórico do WhatsApp no formato .txt exportado.',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      const text = await file.text()
      const job = await importJobsService.create(file.name, text)

      toast({
        title: 'Upload realizado com sucesso',
        description: `O arquivo ${file.name} está sendo processado em segundo plano.`,
      })

      setImportJobs((prev) => [job, ...prev])

      // Also tell the agent about it
      handleSendMessage(
        `Acabei de importar meu histórico do WhatsApp pelo arquivo "${file.name}". O que você pode me dizer sobre minhas finanças?`,
      )
    } catch (err) {
      console.error(err)
      toast({
        title: 'Falha no upload',
        description: 'Não foi possível ler o arquivo enviado.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-8.5rem)]">
      {/* Left Chat Window */}
      <div className="lg:col-span-3 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">Consciente</h3>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  Online (Reasoning)
                </Badge>
              </div>
              <p className="text-xs text-slate-500">Seu parceiro nas finanças em tempo real</p>{' '}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMessages([messages[0]])
              setConversationId(null)
            }}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Nova conversa
          </Button>
        </div>

        {/* Messages Stream */}
        <ScrollArea className="flex-1 p-4 sm:p-6 space-y-4">
          <div className="space-y-4">
            {messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 text-sm ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`space-y-1.5 max-w-[85%] sm:max-w-[75%]`}>
                    <div
                      className={`p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm'
                          : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                      }`}
                    >
                      {m.content}
                    </div>

                    {/* Citations if available */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {m.citations.map((c, idx) => (
                          <span
                            key={idx}
                            title={c.excerpt}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            Fonte [{c.n}]
                          </span>
                        ))}
                      </div>
                    )}

                    <span className="text-[10px] text-slate-400 block px-1">
                      {new Date(m.created).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Currently streaming bubble */}
            {isStreaming && (
              <div className="flex gap-3 text-sm justify-start animate-in fade-in">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-3.5 rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 leading-relaxed whitespace-pre-wrap max-w-[85%] sm:max-w-[75%]">
                  {streamingContent ? (
                    streamingContent
                  ) : (
                    <span className="flex items-center gap-2 text-slate-500 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      Analisando seus dados financeiros...
                    </span>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Sugestões:</span>
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(s)}
              disabled={isStreaming}
              className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 shrink-0 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder="Pergunte sobre seus custos ou peça uma análise..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isStreaming}
              className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 text-sm"
            />
            <Button
              type="submit"
              disabled={isStreaming || !inputText.trim()}
              className="h-11 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Right Column: WhatsApp Real Channel & History Import */}
      <div className="space-y-6">
        {/* Real WhatsApp Status Card - VISÍVEL APENAS PARA ADMINISTRADORES */}
        {isAdmin && (
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  Canal WhatsApp Oficial
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-slate-100 text-slate-700 border-slate-300"
                >
                  Apenas Admin
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Número oficial pelo qual o agente atende seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900 font-mono">
                    {waLive?.owner_phone || '+55 11 94998-9868'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {waLive?.token_configurado || waLive?.owner_connected
                      ? 'Conectado via Meta Cloud API'
                      : 'Token da Meta pendente de configuração'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    waLive?.token_configurado || waLive?.owner_connected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {waLive?.token_configurado || waLive?.owner_connected ? 'Ativo' : 'Pendente'}
                </Badge>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Mensagens como <em>"Almoço 35 reais"</em> ou{' '}
                <em>"Quanto sobrou na caixinha de lazer?"</em> enviadas nesse WhatsApp são
                categorizadas instantaneamente.
              </p>

              <Link
                to="/settings"
                className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium pt-1"
              >
                Gerenciar conexão em Configurações <ExternalLink className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Upload WhatsApp History Box */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-emerald-600" />
              Transferir Histórico do WhatsApp
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Envie o arquivo .txt exportado do WhatsApp da sua IA anterior ou conversa diária.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 rounded-xl p-5 text-center cursor-pointer transition-all"
            >
              <FileText className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800">
                {uploading ? 'Processando arquivo...' : 'Clique para selecionar o arquivo .txt'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Exportação da conversa sem mídia</p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5 border border-slate-100">
              <p className="font-semibold text-slate-800">Como exportar no WhatsApp:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-500">
                <li>Abra a conversa do WhatsApp</li>
                <li>Toque nos 3 pontos &gt; Mais &gt; Exportar conversa</li>
                <li>Selecione "Sem mídia"</li>
                <li>Faça upload do arquivo .txt aqui</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Processed Import Jobs List */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Status das Importações
            </CardTitle>
          </CardHeader>

          <CardContent>
            {importJobs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                Nenhum arquivo importado ainda.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {importJobs.map((j) => (
                  <div
                    key={j.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                        {j.filename || 'conversa.txt'}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          j.status === 'done'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : j.status === 'failed'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {j.status === 'done'
                          ? 'Concluído'
                          : j.status === 'failed'
                            ? 'Falha'
                            : 'Processando'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{j.imported_count} transações criadas</span>
                      <span>
                        {new Date(j.created).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>

                    {j.status === 'done' && (
                      <Link
                        to="/transactions"
                        className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 pt-1 font-medium"
                      >
                        Ver lançamentos importados <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Assistant
