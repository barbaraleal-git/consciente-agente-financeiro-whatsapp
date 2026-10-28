import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface Category extends RecordModel {
  owner: string
  name: string
  type: 'despesa' | 'receita' | 'investimento'
  icon: string
  color: string
}

export interface Transaction extends RecordModel {
  owner: string
  description: string
  amount: number // in cents
  date: string
  category: string
  expand?: {
    category?: Category
  }
  type: 'despesa' | 'receita' | 'investimento'
  source: 'manual' | 'whatsapp' | 'import' | 'agent'
  note?: string
}

export interface Budget extends RecordModel {
  owner: string
  category: string
  expand?: {
    category?: Category
  }
  month: string // YYYY-MM
  amount: number // in cents
}

export interface Alert extends RecordModel {
  owner: string
  title: string
  message: string
  type: 'budget' | 'info' | 'warning'
  read: boolean
}

export interface ImportJob extends RecordModel {
  owner: string
  filename?: string
  status: 'pending' | 'processing' | 'done' | 'failed'
  total_lines: number
  imported_count: number
  raw_content?: string
  error?: string
}

export interface WhatsAppStatus extends RecordModel {
  owner: string
  connected: boolean
  phone_number?: string
}

export interface WhatsAppLiveStatus {
  owner_connected: boolean
  owner_phone: string | null
  phone_number_id?: string
  waba_id?: string
  app_name?: string
  verify_token?: string
  available_numbers: Array<{
    id?: string
    display_phone_number?: string
    phone_number?: string
    verified_name?: string
    quality_rating?: string
  }>
  user_phone: string | null
  user_connected: boolean
  error?: string | null
  webhook_url?: string
  backend_webhook_url?: string
}

export interface WhatsAppContact {
  id: string
  phone_number: string
  name: string
  user_id?: string
  user_name?: string
  is_registered: boolean
  conversation_id?: string
  messages_count: number
  last_message_at?: string
  created: string
}

export interface WhatsAppSimulationResult {
  success: boolean
  simulation: boolean
  phone: string
  user_id: string
  user_name: string
  is_registered: boolean
  conversation_id: string
  reply: string
  connector_sent: boolean
  connector_error: string | null
}

// ----------------- Categories Service -----------------
export const categoriesService = {
  async list(filter = ''): Promise<Category[]> {
    return pb.collection('categories').getFullList<Category>({
      filter,
      sort: 'name',
    })
  },

  async create(data: Partial<Category>): Promise<Category> {
    const owner = pb.authStore.record?.id
    return pb.collection('categories').create<Category>({
      ...data,
      owner,
    })
  },

  async ensureDefaultCategories(): Promise<Category[]> {
    const existing = await this.list()
    if (existing.length > 0) return existing

    const owner = pb.authStore.record?.id
    if (!owner) return []

    const defaults = [
      { name: 'Alimentação', type: 'despesa' as const, icon: 'utensils', color: '#f59e0b' },
      { name: 'Transporte', type: 'despesa' as const, icon: 'car', color: '#3b82f6' },
      { name: 'Moradia', type: 'despesa' as const, icon: 'home', color: '#8b5cf6' },
      { name: 'Saúde', type: 'despesa' as const, icon: 'heart-pulse', color: '#ef4444' },
      { name: 'Lazer', type: 'despesa' as const, icon: 'gamepad', color: '#ec4899' },
      { name: 'Educação', type: 'despesa' as const, icon: 'book', color: '#06b6d4' },
      { name: 'Compras', type: 'despesa' as const, icon: 'shopping-bag', color: '#ec4899' },
      { name: 'Assinaturas', type: 'despesa' as const, icon: 'film', color: '#8b5cf6' },
      { name: 'Salário', type: 'receita' as const, icon: 'banknote', color: '#10b981' },
      {
        name: 'Investimentos',
        type: 'investimento' as const,
        icon: 'trending-up',
        color: '#6366f1',
      },
      { name: 'Outros', type: 'despesa' as const, icon: 'ellipsis', color: '#64748b' },
    ]

    const created: Category[] = []
    for (const d of defaults) {
      try {
        const cat = await pb.collection('categories').create<Category>({
          ...d,
          owner,
        })
        created.push(cat)
      } catch (e) {
        console.warn('Erro ao criar categoria padrão:', e)
      }
    }
    return created
  },

  async update(id: string, data: Partial<Category>): Promise<Category> {
    return pb.collection('categories').update<Category>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('categories').delete(id)
  },
}

// ----------------- Transactions Service -----------------
export const transactionsService = {
  async list(options?: { page?: number; perPage?: number; filter?: string; sort?: string }) {
    const page = options?.page || 1
    const perPage = options?.perPage || 15
    const filter = options?.filter || ''
    const sort = options?.sort || '-date,-created'

    return pb.collection('transactions').getList<Transaction>(page, perPage, {
      filter,
      sort,
      expand: 'category',
    })
  },

  async getFullList(filter = '', sort = '-date'): Promise<Transaction[]> {
    return pb.collection('transactions').getFullList<Transaction>({
      filter,
      sort,
      expand: 'category',
    })
  },

  async create(data: Partial<Transaction>): Promise<Transaction> {
    const owner = pb.authStore.record?.id
    return pb.collection('transactions').create<Transaction>({
      ...data,
      owner,
    })
  },

  async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    return pb.collection('transactions').update<Transaction>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('transactions').delete(id)
  },
}

// ----------------- Budgets Service -----------------
export const budgetsService = {
  async list(month?: string): Promise<Budget[]> {
    const filter = month ? `month = '${month}'` : ''
    return pb.collection('budgets').getFullList<Budget>({
      filter,
      sort: 'category',
      expand: 'category',
    })
  },

  async create(data: Partial<Budget>): Promise<Budget> {
    const owner = pb.authStore.record?.id
    return pb.collection('budgets').create<Budget>({
      ...data,
      owner,
    })
  },

  async update(id: string, data: Partial<Budget>): Promise<Budget> {
    return pb.collection('budgets').update<Budget>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('budgets').delete(id)
  },
}

// ----------------- Alerts Service -----------------
export const alertsService = {
  async list(): Promise<Alert[]> {
    return pb.collection('alerts').getFullList<Alert>({
      sort: '-created',
    })
  },

  async markAsRead(id: string): Promise<Alert> {
    return pb.collection('alerts').update<Alert>(id, { read: true })
  },

  async markAllAsRead(): Promise<void> {
    const alerts = await pb.collection('alerts').getFullList<Alert>({
      filter: 'read = false',
    })
    for (const a of alerts) {
      await pb.collection('alerts').update(a.id, { read: true })
    }
  },
}

// ----------------- Import Jobs Service -----------------
export const importJobsService = {
  async list(): Promise<ImportJob[]> {
    return pb.collection('import_jobs').getFullList<ImportJob>({
      sort: '-created',
    })
  },

  async create(filename: string, rawContent: string): Promise<ImportJob> {
    const owner = pb.authStore.record?.id
    return pb.collection('import_jobs').create<ImportJob>({
      owner,
      filename,
      raw_content: rawContent,
      status: 'pending',
      total_lines: 0,
      imported_count: 0,
    })
  },
}

// ----------------- WhatsApp Status Service -----------------
export const whatsappService = {
  async getStatus(): Promise<WhatsAppStatus | null> {
    const owner = pb.authStore.record?.id
    if (!owner) return null
    try {
      const records = await pb.collection('whatsapp_status').getFullList<WhatsAppStatus>({
        filter: `owner = '${owner}'`,
      })
      if (records.length > 0) return records[0]
      return null
    } catch {
      return null
    }
  },

  async updateStatus(connected: boolean, phoneNumber?: string): Promise<WhatsAppStatus> {
    const owner = pb.authStore.record?.id
    const existing = await this.getStatus()
    if (existing) {
      return pb.collection('whatsapp_status').update<WhatsAppStatus>(existing.id, {
        connected,
        phone_number: phoneNumber,
      })
    }
    return pb.collection('whatsapp_status').create<WhatsAppStatus>({
      owner,
      connected,
      phone_number: phoneNumber,
    })
  },

  async getLiveStatus(): Promise<WhatsAppLiveStatus> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/status`, {
      headers: {
        Authorization: pb.authStore.token,
      },
    })
    if (!res.ok) {
      throw new Error('Falha ao obter status do WhatsApp')
    }
    return res.json()
  },

  async listContacts(): Promise<WhatsAppContact[]> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/contacts`, {
      headers: {
        Authorization: pb.authStore.token,
      },
    })
    if (!res.ok) {
      throw new Error('Falha ao obter contatos do WhatsApp')
    }
    const data = await res.json()
    return data.contacts || []
  },

  async simulateMessage(
    phoneNumber: string,
    message: string,
    senderName?: string,
  ): Promise<WhatsAppSimulationResult> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        message,
        sender_name: senderName,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao simular mensagem de WhatsApp')
    }
    return res.json()
  },
}
