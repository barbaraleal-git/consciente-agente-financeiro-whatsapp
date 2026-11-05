/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0031: Backfill idempotente e permanente de campo 'budget' em transações ativas.
 *
 * Regra oficial do projeto Consciente:
 * Cada lançamento conta em UMA única caixinha.
 *
 * Para transações com status = 'active' (ou '') e type = 'despesa' que estejam com 'budget' vazio:
 * 1. Preenche 'budget' usando a resolução determinística unificada:
 *    - Vínculo único em category_caixinha_links -> caixinha vinculada
 *    - Múltiplos vínculos -> desempate por texto (note / description) com nome/sufixo da caixinha ou primeira candidata estável
 *    - Sem vínculos -> fallback por correspondência de categoria / sufixo / nome
 * 2. Em base vazia é no-op.
 * 3. Transações com status 'cancelled' ou 'deleted' NUNCA são alteradas.
 */
migrate(
  (app) => {
    try {
      console.log('[migration 0031] Iniciando backfill idempotente de budget em transactions...')

      // Carrega todas as transações ativas de despesa com budget vazio
      let activeTxs = []
      try {
        activeTxs = app.findRecordsByFilter(
          'transactions',
          "type = 'despesa' && (status = 'active' || status = '' || status = null) && (budget = '' || budget = null)",
          '-date,-created',
          2000,
          0,
        )
      } catch (txErr) {
        console.log('[migration 0031] Erro ao buscar transações para backfill:', txErr)
        return
      }

      if (activeTxs.length === 0) {
        console.log('[migration 0031] Nenhuma transação ativa com budget vazio encontrada. No-op.')
        return
      }

      console.log(
        `[migration 0031] Encontradas ${activeTxs.length} transações ativas com budget vazio.`,
      )

      // Carrega categorias
      let allCategories = []
      try {
        allCategories = app.findRecordsByFilter('categories', '', '', 500, 0)
      } catch (_) {}
      const catMap = {}
      for (let c = 0; c < allCategories.length; c++) {
        const cat = allCategories[c]
        catMap[cat.id] = {
          id: cat.id,
          name: cat.getString('name') || '',
          normName: String(cat.getString('name') || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim(),
        }
      }

      // Carrega todos os budgets
      let allBudgets = []
      try {
        allBudgets = app.findRecordsByFilter('budgets', '', '-month,-created', 1000, 0)
      } catch (_) {}

      // Carrega vínculos de caixinhas
      let allLinks = []
      try {
        allLinks = app.findRecordsByFilter(
          'category_caixinha_links',
          'active = true',
          '-created',
          1000,
          0,
        )
      } catch (_) {}

      function normStr(s) {
        return String(s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
      }

      let updatedCount = 0

      for (let i = 0; i < activeTxs.length; i++) {
        const tx = activeTxs[i]
        const txOwner = tx.getString('owner') || tx.getString('user')
        if (!txOwner) continue

        const txDateRaw = tx.getString('date') || ''
        const txMonth = txDateRaw ? txDateRaw.slice(0, 7) : ''
        const txCatId = tx.getString('category')
        const txNote = normStr(tx.getString('note'))
        const txDesc = normStr(tx.getString('description'))
        const combined = `${txNote} ${txDesc}`.trim()
        const txCat = catMap[txCatId]
        const txCatName = normStr(txCat ? txCat.name : '')

        // Budgets do usuário
        const userBudgets = allBudgets.filter((b) => {
          const bOwner = b.getString('owner') || b.getString('user')
          return bOwner === txOwner
        })
        if (userBudgets.length === 0) continue

        // Filtra por mês se aplicável
        let monthBudgets = userBudgets.filter((b) => {
          const bMonth = b.getString('month')
          return !bMonth || (txMonth && bMonth === txMonth)
        })
        if (monthBudgets.length === 0) {
          monthBudgets = userBudgets
        }

        // Vínculos do usuário
        const userLinks = allLinks.filter((l) => {
          const lUser = l.getString('user') || l.getString('owner')
          return lUser === txOwner
        })

        let resolvedBudgetId = ''

        // 1. Resolução via category_caixinha_links
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
              // Atribuição estável à primeira candidata
              resolvedBudgetId = candidateBudgetIds[0]
            }
          }
        }

        // 2. Fallback sem vínculos
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
          tx.set('budget', resolvedBudgetId)
          try {
            app.save(tx)
            updatedCount++
          } catch (saveErr) {
            console.log(`[migration 0031] Erro ao salvar transação ${tx.id}:`, saveErr)
          }
        }
      }

      console.log(
        `[migration 0031] Backfill concluído com sucesso: ${updatedCount} transações atualizadas com budget.`,
      )
    } catch (err) {
      console.log('[migration 0031] Erro no processo de backfill:', err)
    }
  },
  (app) => {
    // Revert: idempotente, campos de budget permanecem
  },
)
