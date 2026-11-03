import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import {
  ARQUITETURA_MARKDOWN,
  TESTES_REGRESSIVOS_MARKDOWN,
  BACKLOG_MARKDOWN,
} from '@/data/docsContent'
import { BookOpen, ShieldAlert, FileText, CheckSquare, ListTodo, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export const AdminDocs: React.FC = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'arquitetura' | 'testes' | 'backlog'>('backlog')

  const isAdmin = user?.role === 'admin' || user?.email === 'barbara.ferreira.leal@gmail.com'

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800">Acesso Restrito</h1>
        <p className="text-slate-600 max-w-md mt-2">
          Esta documentação técnica é restrita a administradores do Consciente.
        </p>
        <Button asChild className="mt-4 bg-indigo-600 hover:bg-indigo-700">
          <Link to="/">Voltar ao Início</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao Backoffice
            </Link>
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Documentação do Sistema
            </h1>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              Admin
            </Badge>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Consulte o backlog de pendências, a especificação arquitetural e o roteiro oficial de
            testes regressivos.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'arquitetura' | 'testes' | 'backlog')}
        className="w-full space-y-4"
      >
        <TabsList className="grid grid-cols-3 max-w-lg bg-slate-200/80 p-1">
          <TabsTrigger
            value="backlog"
            className="flex items-center gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-700"
          >
            <ListTodo className="w-4 h-4" />
            Backlog / Pendências
          </TabsTrigger>
          <TabsTrigger
            value="arquitetura"
            className="flex items-center gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-700"
          >
            <FileText className="w-4 h-4" />
            Arquitetura Técnica
          </TabsTrigger>
          <TabsTrigger
            value="testes"
            className="flex items-center gap-2 text-xs sm:text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-indigo-700"
          >
            <CheckSquare className="w-4 h-4" />
            Testes Regressivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backlog">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg font-bold text-slate-900">
                  BACKLOG.md — Backlog / Pendências
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Quadro formal de prioridades do produto com status de cada item (Concluído, Backlog
                e Respondido/Aguardando decisão).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <MarkdownRenderer content={BACKLOG_MARKDOWN} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="arquitetura">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg font-bold text-slate-900">ARQUITETURA.md</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Visão geral da solução, canal oficial WhatsApp Meta Cloud API, agente IA, modelo de
                dados e procedimentos protegidos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <MarkdownRenderer content={ARQUITETURA_MARKDOWN} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testes">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-lg font-bold text-slate-900">
                  TESTES_REGRESSIVOS.md
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Roteiro obrigatório de testes após qualquer ajuste sistêmico (cenários A a M).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <MarkdownRenderer content={TESTES_REGRESSIVOS_MARKDOWN} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminDocs
