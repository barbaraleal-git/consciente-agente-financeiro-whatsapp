import React, { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { alertsService, type Alert } from '@/services/finance'
import { useRealtime } from '@/hooks/use-realtime'
import { Bell, AlertTriangle, Info, CheckCheck } from 'lucide-react'

export const NotificationsPopover: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [open, setOpen] = useState(false)

  const loadAlerts = async () => {
    try {
      const data = await alertsService.list()
      setAlerts(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  // Realtime alerts updates
  useRealtime<Alert>('alerts', () => {
    loadAlerts()
  })

  const unreadCount = alerts.filter((a) => !a.read).length

  const handleMarkAllRead = async () => {
    await alertsService.markAllAsRead()
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
  }

  const handleMarkSingleRead = async (id: string) => {
    await alertsService.markAsRead(id)
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative border-slate-200 hover:bg-slate-100 text-slate-700"
          aria-label="Notificações"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0 bg-white border-slate-200 shadow-xl" align="end">
        <div className="flex items-center justify-between border-b border-slate-100 p-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Alertas de Orçamento</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-red-50 text-red-600 text-[11px]">
                {unreadCount} novos
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs text-indigo-600 hover:text-indigo-700 h-7 px-2"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar lidos
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhuma notificação no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => !alert.read && handleMarkSingleRead(alert.id)}
                  className={`p-3 text-xs transition-colors cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                    !alert.read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {alert.type === 'budget' || alert.type === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Info className="w-4 h-4 text-indigo-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p
                      className={`font-semibold ${alert.read ? 'text-slate-700' : 'text-slate-900'}`}
                    >
                      {alert.title}
                    </p>
                    <p className="text-slate-500 line-clamp-2">{alert.message}</p>
                    <p className="text-[10px] text-slate-400 pt-1">
                      {new Date(alert.created).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!alert.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
