/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const categoriesCol = app.findCollectionByNameOrId('categories')
    const transactionsCol = app.findCollectionByNameOrId('transactions')
    const budgetsCol = app.findCollectionByNameOrId('budgets')
    const whatsappCol = app.findCollectionByNameOrId('whatsapp_status')
    const alertsCol = app.findCollectionByNameOrId('alerts')

    // 1. Seed or find user barbara.ferreira.leal@gmail.com
    let user
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', 'barbara.ferreira.leal@gmail.com')
    } catch (_) {
      user = new Record(users)
      user.setEmail('barbara.ferreira.leal@gmail.com')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Bárbara Leal')
      app.save(user)
    }

    const userId = user.id

    // 2. Default categories for this user
    const defaultCategories = [
      { name: 'Alimentação', type: 'despesa', icon: 'utensils', color: '#f59e0b' },
      { name: 'Transporte', type: 'despesa', icon: 'car', color: '#3b82f6' },
      { name: 'Moradia', type: 'despesa', icon: 'home', color: '#8b5cf6' },
      { name: 'Saúde', type: 'despesa', icon: 'heart-pulse', color: '#ef4444' },
      { name: 'Lazer', type: 'despesa', icon: 'gamepad', color: '#ec4899' },
      { name: 'Educação', type: 'despesa', icon: 'book', color: '#06b6d4' },
      { name: 'Salário', type: 'receita', icon: 'banknote', color: '#10b981' },
      { name: 'Investimentos', type: 'investimento', icon: 'trending-up', color: '#6366f1' },
      { name: 'Outros', type: 'despesa', icon: 'ellipsis', color: '#64748b' },
    ]

    const categoryMap = {}

    for (const item of defaultCategories) {
      const existing = app.findRecordsByFilter(
        'categories',
        `owner = '${userId}' && name = '${item.name}'`,
        '',
        1,
        0,
      )
      if (existing.length > 0) {
        categoryMap[item.name] = existing[0].id
      } else {
        const rec = new Record(categoriesCol)
        rec.set('owner', userId)
        rec.set('name', item.name)
        rec.set('type', item.type)
        rec.set('icon', item.icon)
        rec.set('color', item.color)
        app.save(rec)
        categoryMap[item.name] = rec.id
      }
    }

    // 3. Budgets for current month
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const budgetItems = [
      { category: 'Alimentação', amount: 150000 }, // R$ 1.500,00
      { category: 'Transporte', amount: 60000 }, // R$ 600,00
      { category: 'Lazer', amount: 50000 }, // R$ 500,00
      { category: 'Moradia', amount: 220000 }, // R$ 2.200,00
    ]

    for (const b of budgetItems) {
      const catId = categoryMap[b.category]
      if (!catId) continue
      const existing = app.findRecordsByFilter(
        'budgets',
        `owner = '${userId}' && category = '${catId}' && month = '${currentMonth}'`,
        '',
        1,
        0,
      )
      if (existing.length === 0) {
        const bRec = new Record(budgetsCol)
        bRec.set('owner', userId)
        bRec.set('category', catId)
        bRec.set('month', currentMonth)
        bRec.set('amount', b.amount)
        app.save(bRec)
      }
    }

    // 4. Sample transactions (5-8 manual transactions)
    const existingTx = app.findRecordsByFilter('transactions', `owner = '${userId}'`, '', 1, 0)
    if (existingTx.length === 0) {
      const todayStr = now.toISOString().slice(0, 10)
      const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString().slice(0, 10)
      const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10)

      const sampleTransactions = [
        {
          description: 'Salário Mensal',
          amount: 850000, // R$ 8.500,00
          date: fiveDaysAgo,
          category: categoryMap['Salário'],
          type: 'receita',
          source: 'manual',
          note: 'Recebimento salário da empresa',
        },
        {
          description: 'Supermercado Pão de Açúcar',
          amount: 43250, // R$ 432,50
          date: yesterday,
          category: categoryMap['Alimentação'],
          type: 'despesa',
          source: 'manual',
          note: 'Compras do mês',
        },
        {
          description: 'Aluguel e Condomínio',
          amount: 210000, // R$ 2.100,00
          date: fiveDaysAgo,
          category: categoryMap['Moradia'],
          type: 'despesa',
          source: 'manual',
          note: 'Boleto pago via app',
        },
        {
          description: 'Combustível Posto Ipiranga',
          amount: 24000, // R$ 240,00
          date: threeDaysAgo,
          category: categoryMap['Transporte'],
          type: 'despesa',
          source: 'manual',
          note: 'Tanque cheio',
        },
        {
          description: 'Jantar Restaurante Italiano',
          amount: 18500, // R$ 185,00
          date: todayStr,
          category: categoryMap['Lazer'],
          type: 'despesa',
          source: 'manual',
          note: 'Comemoração',
        },
        {
          description: 'Aporte Tesouro Selic',
          amount: 100000, // R$ 1.000,00
          date: yesterday,
          category: categoryMap['Investimentos'],
          type: 'investimento',
          source: 'manual',
          note: 'Reserva de emergência',
        },
        {
          description: 'Farmácia Drogasil',
          amount: 7890, // R$ 78,90
          date: todayStr,
          category: categoryMap['Saúde'],
          type: 'despesa',
          source: 'manual',
          note: 'Vitaminas e analgésicos',
        },
      ]

      for (const tx of sampleTransactions) {
        if (!tx.category) continue
        const rec = new Record(transactionsCol)
        rec.set('owner', userId)
        rec.set('description', tx.description)
        rec.set('amount', tx.amount)
        rec.set('date', tx.date)
        rec.set('category', tx.category)
        rec.set('type', tx.type)
        rec.set('source', tx.source)
        rec.set('note', tx.note)
        app.save(rec)
      }
    }

    // 5. WhatsApp status seed
    const existingWa = app.findRecordsByFilter('whatsapp_status', `owner = '${userId}'`, '', 1, 0)
    if (existingWa.length === 0) {
      const wa = new Record(whatsappCol)
      wa.set('owner', userId)
      wa.set('connected', true)
      wa.set('phone_number', '+55 (11) 98765-4321')
      app.save(wa)
    }

    // 6. Seed an alert
    const existingAlerts = app.findRecordsByFilter('alerts', `owner = '${userId}'`, '', 1, 0)
    if (existingAlerts.length === 0) {
      const al = new Record(alertsCol)
      al.set('owner', userId)
      al.set('title', 'Aviso de Orçamento: Moradia')
      al.set('message', 'Você atingiu 95% do limite estipulado para Moradia neste mês.')
      al.set('type', 'budget')
      al.set('read', false)
      app.save(al)
    }
  },
  (app) => {
    // down migration
  },
)
