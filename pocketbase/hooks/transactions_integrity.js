/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Integridade de Transações (WhatsApp, Web, Import, Agent).
 *
 * Garante que:
 * 1. Toda nova transação nasça com status = 'active' se o status vier vazio ou nulo.
 * 2. Toda nova transação tenha is_retroactive = true SEMPRE que a data informada (record.date)
 *    for diferente do dia da mensagem (message_timestamp) ou do dia da criação do registro.
 * 3. Deleções acidentais via API client em 'transactions' sejam convertidas em deleção lógica
 *    (status = 'deleted') para respeitar a regra permanente: NADA É APAGADO FISICAMENTE.
 */

onRecordCreate((e) => {
  try {
    const record = e.record
    if (!record) return e.next()

    // 1. Garantia de status='active' por padrão
    const currentStatus = record.getString('status')
    if (!currentStatus) {
      record.set('status', 'active')
    }

    // 2. Garantia de is_retroactive = true quando data for diferente do dia da mensagem/hoje
    const dateStr = (record.getString('date') || '').slice(0, 10)
    const msgTs = record.getString('message_timestamp')
    const refDay = msgTs ? msgTs.slice(0, 10) : new Date().toISOString().slice(0, 10)

    if (dateStr && refDay && dateStr !== refDay) {
      record.set('is_retroactive', true)
      console.log(
        `[transactions_integrity] Transação marcada como retroativa: date=${dateStr} vs ref=${refDay}`,
      )
    }

    // 3. PERSISTÊNCIA AUTOMÁTICA DE CAIXINHA (budget):
    // Se a transação for de despesa e o campo budget estiver vazio, resolve deterministicamente
    // e persiste para garantir que NENHUMA transação ativa fique sem sua caixinha e que haja 100% de
    // paridade entre o banco de dados, o aplicativo e o agente WhatsApp.
    const txType = record.getString('type')
    const currentBudget = record.getString('budget')
    const txOwner = record.getString('owner') || record.getString('user')

    if (txType === 'despesa' && !currentBudget && txOwner) {
      const txCatId = record.getString('category')
      const txMonth = dateStr ? dateStr.slice(0, 7) : refDay.slice(0, 7)

      function normStr(s) {
        return String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
      }

      const txNote = normStr(record.getString('note'))
      const txDesc = normStr(record.getString('description'))
      const combined = `${txNote} ${txDesc}`.trim()

      // Carrega budgets do usuário
      let userBudgets = []
      try {
        userBudgets = e.app.findRecordsByFilter(
          'budgets',
          `owner = '${txOwner}'`,
          '-month,-created',
          100,
          0,
        )
      } catch (_) {}

      if (userBudgets.length > 0) {
        let monthBudgets = userBudgets.filter((b) => {
          const m = b.getString('month')
          return !m || m === txMonth
        })
        if (monthBudgets.length === 0) monthBudgets = userBudgets

        // Carrega vínculos personalizados
        let userLinks = []
        try {
          userLinks = e.app.findRecordsByFilter(
            'category_caixinha_links',
            `user = '${txOwner}' && active = true`,
            '-created',
            100,
            0,
          )
        } catch (_) {}

        // Carrega categorias para metadados
        let allCats = []
        try {
          allCats = e.app.findRecordsByFilter('categories', '', '', 300, 0)
        } catch (_) {}
        const catMap = {}
        for (let c = 0; c < allCats.length; c++) {
          const cRec = allCats[c]
          catMap[cRec.id] = {
            id: cRec.id,
            name: cRec.getString('name') || '',
            normName: normStr(cRec.getString('name')),
          }
        }

        const txCat = catMap[txCatId]
        const txCatName = normStr(txCat ? txCat.name : '')

        let resolvedBudgetId = ''

        // (a) Resolução via category_caixinha_links
        if (userLinks.length > 0) {
          const candidateBudgetIds = []
          for (let l = 0; l < userLinks.length; l++) {
            const lk = userLinks[l]
            const lkCatId = lk.getString('category_id') || lk.getString('category')
            const lkCatName = normStr(lk.getString('category_name'))
            const bId = lk.getString('budget')
            if (!bId) continue

            let isCand = false
            if (lkCatId && txCatId && lkCatId === txCatId) {
              isCand = true
            } else if (
              txCatName &&
              lkCatName &&
              (txCatName === lkCatName ||
                txCatName.includes(lkCatName) ||
                lkCatName.includes(txCatName))
            ) {
              isCand = true
            }

            if (isCand && !candidateBudgetIds.includes(bId)) {
              candidateBudgetIds.push(bId)
            }
          }

          if (candidateBudgetIds.length === 1) {
            resolvedBudgetId = candidateBudgetIds[0]
          } else if (candidateBudgetIds.length > 1) {
            // Desempate por texto (note / descrição)
            for (let c = 0; c < candidateBudgetIds.length; c++) {
              const candId = candidateBudgetIds[c]
              const candBudget = monthBudgets.find((b) => b.id === candId)
              if (!candBudget) continue
              const candCat = catMap[candBudget.getString('category')]
              if (candCat && candCat.normName && combined.includes(candCat.normName)) {
                resolvedBudgetId = candId
                break
              }
              if (candCat && candCat.name) {
                const parts = candCat.name.split('-').map((p) => normStr(p))
                if (parts.length > 1) {
                  const suffix = parts[parts.length - 1]
                  if (suffix && suffix.length >= 2) {
                    const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
                    if (regex.test(combined)) {
                      resolvedBudgetId = candId
                      break
                    }
                  }
                }
              }
            }
            if (!resolvedBudgetId) {
              resolvedBudgetId = candidateBudgetIds[0]
            }
          }
        }

        // (b) Fallback sem vínculos
        if (!resolvedBudgetId) {
          let bestScore = 0
          let bestBudgetId = ''

          for (let b = 0; b < monthBudgets.length; b++) {
            const bg = monthBudgets[b]
            const bCatId = bg.getString('category')
            const bCat = catMap[bCatId]
            let score = 0

            if (txCatId && bCatId && txCatId === bCatId) {
              score = 100
            }

            if (bCat && bCat.name) {
              const parts = bCat.name.split('-').map((p) => normStr(p))
              if (parts.length > 1) {
                const suffix = parts[parts.length - 1]
                if (suffix && suffix.length >= 2) {
                  const regex = new RegExp(`(^|[^a-z0-9])${suffix}([^a-z0-9]|$)`, 'i')
                  if (regex.test(combined)) {
                    score = Math.max(score, 80)
                  }
                }
              }
              if (bCat.normName && combined.includes(bCat.normName)) {
                score = Math.max(score, 70)
              }
              if (txCatName && bCat.normName) {
                if (bCat.normName.includes(txCatName) || txCatName.includes(bCat.normName)) {
                  score = Math.max(score, 50)
                }
              }
            }

            if (score > bestScore) {
              bestScore = score
              bestBudgetId = bg.id
            }
          }

          if (bestBudgetId) {
            resolvedBudgetId = bestBudgetId
          }
        }

        if (resolvedBudgetId) {
          record.set('budget', resolvedBudgetId)
          console.log(
            `[transactions_integrity] Budget '${resolvedBudgetId}' atribuído automaticamente à transação de despesa '${record.getString('description')}'`,
          )
        }
      }
    }
  } catch (err) {
    console.error('[transactions_integrity] Erro em onRecordCreate:', err)
  }

  return e.next()
}, 'transactions')

// Intercepta deleção física de transações e converte em lógica (status='deleted')
onRecordDelete((e) => {
  try {
    const record = e.record
    if (record) {
      console.log(
        `[transactions_integrity] Interceptando deleção física de transação ${record.id}: marcando como status='deleted'`,
      )
      record.set('status', 'deleted')
      e.app.save(record)
      // Cancela a deleção física retornando erro controlado ou abortando a remoção do banco
      throw new BadRequestError(
        'Transações utilizam deleção lógica. Registro marcado como excluído.',
      )
    }
  } catch (err) {
    // Se for nosso erro de proteção, propaga para abortar a exclusão física
    if (String(err).includes('deleção lógica')) {
      throw err
    }
    console.error('[transactions_integrity] Erro ao proteger deleção física:', err)
  }
  return e.next()
}, 'transactions')
