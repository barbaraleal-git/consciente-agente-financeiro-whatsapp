import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { NotificationsPopover } from './NotificationsPopover'
import { TransactionModal } from './TransactionModal'
import {
  LayoutDashboard,
  Receipt,
  Tags,
  PiggyBank,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  Plus,
  Wallet,
  ShieldCheck,
  BookOpen,
} from 'lucide-react'

const baseNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/transactions', label: 'Transações', icon: Receipt },
  { path: '/categories', label: 'Categorias', icon: Tags },
  { path: '/budgets', label: 'Caixinhas', icon: PiggyBank },
  { path: '/reports', label: 'Relatórios', icon: BarChart3 },
  { path: '/assistant', label: 'Assistente', icon: Bot },
  { path: '/settings', label: 'Minha Conta', icon: Settings },
]

export const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Get active page title
  const isAdmin = user?.role === 'admin' || user?.email === 'barbara.ferreira.leal@gmail.com'

  const navItems = [
    ...baseNavItems,
    ...(isAdmin
      ? [
          { path: '/admin', label: 'Backoffice', icon: ShieldCheck },
          { path: '/admin/docs', label: 'Documentação', icon: BookOpen },
        ]
      : []),
  ]

  const currentNav = navItems.find((n) => n.path === location.pathname)
  const pageTitle = currentNav ? currentNav.label : 'Painel Financeiro'

  // User initials
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AF'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 antialiased">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-100 border-r border-slate-800 shrink-0 select-none">
        {/* Brand */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base text-white tracking-tight leading-tight truncate">
              Consciente
            </h1>
            <p className="text-[11px] text-indigo-300 font-medium truncate">
              Seu parceiro nas finanças
            </p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-md" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`}
                />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* User profile card & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="w-9 h-9 border border-indigo-500/30 bg-indigo-950 text-indigo-300">
                <AvatarFallback className="text-xs font-semibold bg-indigo-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 shrink-0"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile icon */}
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white md:hidden shadow-sm">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                {pageTitle}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium md:hidden">
                Consciente - Seu parceiro nas finanças
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsPopover />

            <Button
              onClick={() => setModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 text-xs sm:text-sm h-9 px-3 sm:px-4 font-medium transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-1 sm:mr-1.5" />
              Novo Lançamento
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex items-center justify-around py-2 px-1 md:hidden">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Início</span>
        </NavLink>
        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`
          }
        >
          <Receipt className="w-4 h-4" />
          <span>Lançamentos</span>
        </NavLink>
        <NavLink
          to="/assistant"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`
          }
        >
          <Bot className="w-4 h-4" />
          <span>Assistente</span>
        </NavLink>
        <NavLink
          to="/reports"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`
          }
        >
          <BarChart3 className="w-4 h-4" />
          <span>Relatórios</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-1 px-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          <span>Minha Conta</span>
        </NavLink>
      </nav>

      {/* Global Quick Add Transaction Modal */}
      <TransactionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => {
          // Window event to inform active page to refresh records if needed
          window.dispatchEvent(new Event('finance-refresh'))
        }}
      />
    </div>
  )
}

export default Layout
