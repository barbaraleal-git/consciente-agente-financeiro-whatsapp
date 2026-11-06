import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface Category extends RecordModel {
  owner: string
  name: string
  type: 'despesa' | 'receita' | 'investimento'
  icon: string
  color: string
}

export type TransactionSource =
  | 'manual'
  | 'whatsapp'
  | 'import'
  | 'agent'
  | 'whatsapp_text'
  | 'whatsapp_audio'

export type TransactionStatus = 'active' | 'cancelled' | 'deleted'

export interface Transaction extends RecordModel {
  owner: string
  amount: number // in cents
  description: string
  date: string // YYYY-MM-DD
  category: string
  expand?: {
    category?: Category
  }
  type: 'despesa' | 'receita' | 'investimento'
  source: TransactionSource
  message_timestamp?: string // Data/hora da mensagem original ISO
  note?: string
  status?: TransactionStatus
  is_retroactive?: boolean
  budget?: string // ID da caixinha única associada
}
export interface Budget extends RecordModel {
  owner: string
  name?: string
  icon?: string
  color?: string
  category?: string
  expand?: {
    category?: Category
  }
  month: string // YYYY-MM
  amount: number // in cents
}

export interface CategoryCaixinhaLink extends RecordModel {
  user: string
  budget: string
  category_name: string
  category_id?: string
  active: boolean
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
  phone_number_id?: string
  waba_id?: string
  app_name?: string
  verify_token?: string
  last_send_status?: string
  last_send_error?: string
  last_send_at?: string
}

export interface WhatsAppLiveStatus {
  owner_connected: boolean
  token_configurado?: boolean
  stt_configurado?: boolean
  owner_phone: string | null
  phone_number_id?: string
  waba_id?: string
  app_name?: string
  verify_token?: string
  user_phone: string | null
  user_connected: boolean
  last_send_status?: string
  last_send_error?: string
  last_send_at?: string
  webhook_url?: string
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
  remote_sent?: boolean
  remote_error?: string | null
}

export interface WhatsAppSendTestResult {
  success: boolean
  message_id?: string
  data?: unknown
  error?: string
  missing_token?: boolean
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
    // Deleção lógica permanente (Item 27): nunca remove o registro fisicamente
    try {
      await pb.collection('transactions').update(id, { status: 'deleted' })
      return true
    } catch (_) {
      return false
    }
  },

  async cancel(id: string): Promise<Transaction> {
    // Cancelamento do cliente (Item 23): marca status como 'cancelled'
    return pb.collection('transactions').update<Transaction>(id, { status: 'cancelled' })
  },
}

// ----------------- Budgets Service -----------------
export const budgetsService = {
  async list(month?: string): Promise<Budget[]> {
    const filter = month ? `month = '${month}'` : ''
    return pb.collection('budgets').getFullList<Budget>({
      filter,
      sort: 'name,-created',
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

// ----------------- Category Caixinha Links Service -----------------
export const categoryCaixinhaLinksService = {
  async list(budgetId?: string): Promise<CategoryCaixinhaLink[]> {
    const filter = budgetId ? `budget = '${budgetId}'` : ''
    return pb.collection('category_caixinha_links').getFullList<CategoryCaixinhaLink>({
      filter,
      sort: 'category_name',
    })
  },

  async listByUser(): Promise<CategoryCaixinhaLink[]> {
    return pb.collection('category_caixinha_links').getFullList<CategoryCaixinhaLink>({
      sort: 'category_name',
    })
  },

  async create(data: Partial<CategoryCaixinhaLink>): Promise<CategoryCaixinhaLink> {
    const user = pb.authStore.record?.id
    return pb.collection('category_caixinha_links').create<CategoryCaixinhaLink>({
      ...data,
      user,
      active: data.active !== undefined ? data.active : true,
    })
  },

  async update(id: string, data: Partial<CategoryCaixinhaLink>): Promise<CategoryCaixinhaLink> {
    return pb.collection('category_caixinha_links').update<CategoryCaixinhaLink>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('category_caixinha_links').delete(id)
  },

  async syncBudgetLinks(
    budgetId: string,
    categoryNames: Array<{ name: string; id?: string }>,
  ): Promise<void> {
    const user = pb.authStore.record?.id
    if (!user) return

    // Busca vínculos atuais da caixinha
    const currentLinks = await this.list(budgetId)
    const currentMap = new Map<string, CategoryCaixinhaLink>()
    currentLinks.forEach((link) => {
      currentMap.set(link.category_name.toLowerCase().trim(), link)
    })

    const targetNamesSet = new Set(categoryNames.map((c) => c.name.toLowerCase().trim()))

    // 1. Remove ou desativa vínculos que não estão mais marcados
    for (const [key, link] of currentMap.entries()) {
      if (!targetNamesSet.has(key)) {
        await this.delete(link.id)
      }
    }

    // 2. Adiciona novos vínculos
    for (const target of categoryNames) {
      const key = target.name.toLowerCase().trim()
      if (!currentMap.has(key)) {
        await this.create({
          budget: budgetId,
          category_name: target.name.trim(),
          category_id: target.id || '',
          active: true,
        })
      }
    }
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
    try {
      if (owner) {
        const records = await pb.collection('whatsapp_status').getFullList<WhatsAppStatus>({
          filter: `owner = '${owner}'`,
        })
        if (records.length > 0) return records[0]
      }
      // Se não houver registro vinculado ao usuário ou owner for nulo, busca o registro global do canal
      const globalRecords = await pb.collection('whatsapp_status').getFullList<WhatsAppStatus>({
        sort: '-created',
        limit: 1,
      })
      if (globalRecords.length > 0) return globalRecords[0]
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
        owner: owner || existing.owner,
        connected,
        phone_number: phoneNumber,
      })
    }
    return pb.collection('whatsapp_status').create<WhatsAppStatus>({
      owner: owner || '',
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
    sendRemote = true,
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
        send_remote: sendRemote,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao simular mensagem de WhatsApp')
    }
    return res.json()
  },

  async saveMetaToken(accessToken: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        access_token: accessToken,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao salvar o token da Meta')
    }
    return res.json()
  },

  async saveSttKey(
    sttApiKey: string,
  ): Promise<{ success: boolean; stt_configurado: boolean; message: string }> {
    const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/stt-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({
        stt_api_key: sttApiKey,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao salvar a chave de transcrição (STT)')
    }
    return res.json()
  },

  async sendTestMessage(toNumber: string, text?: string): Promise<WhatsAppSendTestResult> {
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/send-test`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          to_number: toNumber,
          text,
        }),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Erro HTTP ${res.status}`,
        missing_token: !!data.missing_token,
      }
    }
    return data
  },

  async linkContact(
    contactId?: string,
    phoneNumber?: string,
  ): Promise<{ success: boolean; contact_id: string; user_id: string }> {
    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/link-contact`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          contact_id: contactId,
          phone_number: phoneNumber,
        }),
      },
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Falha ao vincular contato do WhatsApp')
    }
    return res.json()
  },

  async updateProfilePicture(
    file: File,
  ): Promise<{ success: boolean; message?: string; error?: string; phone_number_id?: string }> {
    // Converte o arquivo para Base64 para garantir compatibilidade total de transporte
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = (e) => reject(e)
      reader.readAsDataURL(file)
    })

    const payload = {
      image_base64: base64Data,
      file_name: file.name || 'profile_picture.jpg',
      file_type: file.type || 'image/jpeg',
    }

    const res = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/profile-picture`,
      {
        method: 'POST',
        headers: {
          Authorization: pb.authStore.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        data.error ||
        data.meta_error?.message ||
        `Erro HTTP ${res.status} ao atualizar foto do perfil na Meta`
      throw new Error(msg)
    }
    return data
  },
}

export interface AdminMetrics {
  total_clients: number
  active_clients_7d: number
  active_clients_30d: number
  total_transactions: number
  active_whatsapp_conversations: number
}

export interface AdminClientSummary {
  id: string
  name: string
  email: string
  phone: string
  role: 'client' | 'admin'
  created: string
  updated: string
  onboarding_completed: boolean
  has_whatsapp_linked: boolean
  whatsapp_contact_id: string
  caixinhas_count: number
  transactions_count: number
}

export interface AdminClientDetail {
  client: {
    id: string
    name: string
    email: string
    phone: string
    role: 'client' | 'admin'
    onboarding_completed: boolean
    created: string
    updated: string
  }
  caixinhas: Array<{
    id: string
    category_id: string
    category_name: string
    icon: string
    color: string
    limit_cents: number
    spent_cents: number
    period: string
  }>
  recent_transactions: Array<{
    id: string
    amount_cents: number
    type: string
    description: string
    category_name: string
    date: string
    created: string
    source?: string
    status?: string
    is_retroactive?: boolean
    is_recurring: boolean
  }>
  whatsapp: {
    phone: string
    is_linked: boolean
    contact_id: string | null
    contact_name: string | null
    contact_phone: string | null
    last_interaction: string | null
    thread_id: string | null
  }
  conversation_history: Array<{
    id: string
    direction: string
    message_text: string
    status: string
    created: string
  }>
  estimated_cost?: {
    month: string
    tx_audio_count: number
    tx_text_count: number
    tx_manual_count: number
    tx_total_count: number
    ai_messages_count: number
    utility_messages_count: number
    cost_audio_brl: number
    cost_ai_brl: number
    cost_utility_brl: number
    total_cost_brl: number
  }
}

export interface AdminClientCostItem {
  client_id: string
  client_name: string
  client_email: string
  client_phone: string
  has_whatsapp_linked: boolean
  tx_audio_count: number
  tx_text_count: number
  tx_manual_count: number
  tx_total_count: number
  ai_messages_count: number
  utility_messages_count: number
  cost_audio_brl: number
  cost_ai_brl: number
  cost_utility_brl: number
  estimated_cost_brl: number
}

export interface AdminCostsResponse {
  month: string
  available_months: string[]
  rates: {
    audio_tx: number
    ai_message: number
    utility_message: number
    service_message: number
  }
  totals: {
    total_clients: number
    total_audio_tx: number
    total_text_tx: number
    total_manual_tx: number
    total_tx: number
    total_ai_messages: number
    total_utility_messages: number
    cost_audio_brl: number
    cost_ai_brl: number
    cost_utility_brl: number
    total_estimated_cost_brl: number
  }
  clients: AdminClientCostItem[]
}

export const adminService = {
  getOverview: async (): Promise<{ metrics: AdminMetrics; clients: AdminClientSummary[] }> => {
    return pb.send('/backend/v1/admin/overview', {
      method: 'GET',
    })
  },

  getClientDetail: async (clientId: string, month?: string): Promise<AdminClientDetail> => {
    const q = month ? `?month=${encodeURIComponent(month)}` : ''
    return pb.send(`/backend/v1/admin/clients/${clientId}${q}`, {
      method: 'GET',
    })
  },

  getCosts: async (month?: string): Promise<AdminCostsResponse> => {
    const q = month ? `?month=${encodeURIComponent(month)}` : ''
    return pb.send(`/backend/v1/admin/costs${q}`, {
      method: 'GET',
    })
  },

  resetClientThread: async (
    clientId: string,
  ): Promise<{ success: boolean; message: string; contacts_reset: number }> => {
    return pb.send(`/backend/v1/admin/clients/${clientId}/reset-thread`, {
      method: 'POST',
    })
  },

  toggleClientWhatsapp: async (
    clientId: string,
    action: 'link' | 'unlink' | 'toggle',
    phone?: string,
  ): Promise<{ success: boolean; phone: string; is_linked: boolean; message: string }> => {
    return pb.send(`/backend/v1/admin/clients/${clientId}/toggle-whatsapp`, {
      method: 'POST',
      body: { action, phone },
    })
  },
}

export interface CompanyLegalInfo {
  id?: string
  company_name: string
  trade_name: string
  cnpj: string
  address_full: string
  email_contact: string
  support_phone_or_bot?: string
  terms_version?: string
  privacy_version?: string
  trial_days_default?: number
  carencia_days_default?: number
}

export interface SubscriptionPlanItem {
  id: string
  plan_type: 'mensal' | 'anual'
  name: string
  price_cents: number
  stripe_price_id?: string
  stripe_product_id?: string
  valid_from?: string
  valid_until?: string
  active?: boolean
  notes?: string
  user_override?: string
  user_override_info?: { name: string; email: string } | null
  created?: string
  updated?: string
}

export interface BillingStatusResponse {
  status: 'trial' | 'active' | 'carencia' | 'bloqueado' | 'cancelado'
  plan: 'mensal' | 'anual'
  expires_at?: string
  carencia_until?: string
  has_stripe_customer: boolean
  has_stripe_subscription: boolean
  user_info: {
    id: string
    name: string
    full_name?: string
    email: string
    cpf?: string
    birth_date?: string
    phone?: string
    address?: {
      zip_code?: string
      street?: string
      number?: string
      complement?: string
      neighborhood?: string
      city?: string
      state?: string
    }
    terms_accepted_at?: string
    recurring_consent_accepted_at?: string
  }
  plans: {
    mensal: {
      id: string
      plan_type: 'mensal'
      name: string
      price_cents: number
      stripe_price_id?: string
      stripe_product_id?: string
      is_override: boolean
    }
    anual: {
      id: string
      plan_type: 'anual'
      name: string
      price_cents: number
      stripe_price_id?: string
      stripe_product_id?: string
      is_override: boolean
    }
  }
  legal_info: CompanyLegalInfo
}

export interface AdminSubscriptionsResponse {
  metrics: {
    total: number
    active: number
    trial: number
    carencia: number
    bloqueado: number
    cancelado: number
  }
  clients: Array<{
    id: string
    name: string
    full_name: string
    email: string
    phone: string
    cpf: string
    subscription_status: 'trial' | 'active' | 'carencia' | 'bloqueado' | 'cancelado'
    subscription_plan: 'mensal' | 'anual'
    subscription_expires_at?: string
    carencia_until?: string
    stripe_customer_id?: string
    stripe_subscription_id?: string
    terms_accepted_at?: string
    recurring_consent_accepted_at?: string
    created: string
  }>
}

export const billingService = {
  getStatus: async (): Promise<BillingStatusResponse> => {
    return pb.send('/backend/v1/billing/status', {
      method: 'GET',
    })
  },

  createCheckoutSession: async (
    planType: 'mensal' | 'anual',
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<{ session_id: string; url: string; plan: unknown }> => {
    return pb.send('/backend/v1/billing/create-checkout-session', {
      method: 'POST',
      body: {
        plan_type: planType,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
    })
  },

  syncSession: async (
    sessionId: string,
  ): Promise<{
    success: boolean
    status?: string
    plan?: string
    expires_at?: string
    message: string
  }> => {
    return pb.send('/backend/v1/billing/sync-session', {
      method: 'POST',
      body: { session_id: sessionId },
    })
  },

  cancelSubscription: async (): Promise<{ success: boolean; status: string; message: string }> => {
    return pb.send('/backend/v1/billing/cancel-subscription', {
      method: 'POST',
    })
  },

  createPortalSession: async (returnUrl?: string): Promise<{ url: string }> => {
    return pb.send('/backend/v1/billing/create-portal-session', {
      method: 'POST',
      body: { return_url: returnUrl },
    })
  },

  updateProfile: async (data: {
    full_name?: string
    cpf?: string
    birth_date?: string
    zip_code?: string
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
    accept_terms?: boolean
    accept_recurring?: boolean
  }): Promise<{ success: boolean; message: string }> => {
    return pb.send('/backend/v1/billing/update-profile', {
      method: 'POST',
      body: data,
    })
  },

  // Admin Billing endpoints
  adminGetPlans: async (): Promise<{
    plans: SubscriptionPlanItem[]
    legal_info: CompanyLegalInfo | null
  }> => {
    return pb.send('/backend/v1/admin/billing/plans', {
      method: 'GET',
    })
  },

  adminSavePlan: async (
    planData: Partial<SubscriptionPlanItem>,
  ): Promise<{ success: boolean; message: string; id: string }> => {
    return pb.send('/backend/v1/admin/billing/plans', {
      method: 'POST',
      body: planData,
    })
  },

  adminSaveLegalInfo: async (
    legalData: Partial<CompanyLegalInfo>,
  ): Promise<{ success: boolean; message: string }> => {
    return pb.send('/backend/v1/admin/billing/legal-info', {
      method: 'POST',
      body: legalData,
    })
  },

  adminGetSubscriptions: async (): Promise<AdminSubscriptionsResponse> => {
    return pb.send('/backend/v1/admin/billing/subscriptions', {
      method: 'GET',
    })
  },

  adminSetupStripeProducts: async (): Promise<{
    success: boolean
    message: string
    data: unknown
  }> => {
    return pb.send('/backend/v1/admin/billing/setup-stripe-products', {
      method: 'POST',
    })
  },
}
