/// <reference path="../pb_data/types.d.ts" />

cronAdd('budget-check', '0 * * * *', () => {
  try {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Find all budgets for this month
    const budgets = $app.findRecordsByFilter('budgets', `month = '${currentMonth}'`, '', 500, 0)
    if (!budgets || budgets.length === 0) return

    const alertsCol = $app.findCollectionByNameOrId('alerts')

    for (const budget of budgets) {
      const ownerId = budget.getString('owner')
      const catId = budget.getString('category')
      const budgetAmount = budget.getInt('amount')
      if (budgetAmount <= 0) continue

      // Sum transactions for this category, month, and owner
      const txs = $app.findRecordsByFilter(
        'transactions',
        `owner = '${ownerId}' && category = '${catId}' && date >= '${currentMonth}-01' && date <= '${currentMonth}-31' && type = 'despesa'`,
        '',
        1000,
        0,
      )

      let spent = 0
      for (const t of txs) {
        spent += t.getInt('amount')
      }

      const ratio = spent / budgetAmount
      if (ratio >= 0.8) {
        let categoryName = 'Categoria'
        try {
          const catRec = $app.findRecordById('categories', catId)
          categoryName = catRec.getString('name')
        } catch (_) {}

        const percentage = Math.round(ratio * 100)
        const isExceeded = ratio >= 0.9
        const alertType = isExceeded ? 'budget' : 'warning'
        const title = isExceeded
          ? `Alerta Crítico: Orçamento de ${categoryName}`
          : `Aviso: Orçamento de ${categoryName} em ${percentage}%`
        const message = `Você já utilizou ${percentage}% do orçamento de ${categoryName} neste mês (R$ ${(spent / 100).toFixed(2)} de R$ ${(budgetAmount / 100).toFixed(2)}).`

        // Check if alert already exists today for this owner and title
        const todayStr = now.toISOString().slice(0, 10)
        const existingAlert = $app.findRecordsByFilter(
          'alerts',
          `owner = '${ownerId}' && title = '${title}' && created >= '${todayStr} 00:00:00'`,
          '',
          1,
          0,
        )

        if (existingAlert.length === 0) {
          const al = new Record(alertsCol)
          al.set('owner', ownerId)
          al.set('title', title)
          al.set('message', message)
          al.set('type', alertType)
          al.set('read', false)
          $app.save(al)
        }
      }
    }
  } catch (err) {
    console.log('Error in budget-check cron:', err)
  }
})
