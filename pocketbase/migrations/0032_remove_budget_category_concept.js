/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0032:
 * 1. Adiciona campos 'name', 'icon' e 'color' diretamente na coleção 'budgets'
 *    para que a caixinha seja uma entidade independente com identidade própria.
 * 2. Remove a obrigatoriedade (required = false) do campo 'category' em 'budgets'.
 * 3. Migra dados das categorias existentes para os novos campos (name, icon, color) de cada budget.
 * 4. Limpa completamente o campo 'category' de TODAS as caixinhas existentes na base (category = null).
 */
migrate(
  (app) => {
    let budgetsCol
    try {
      budgetsCol = app.findCollectionByNameOrId('budgets')
    } catch (e) {
      console.log('[migration 0032] Coleção budgets não encontrada:', e)
      return
    }

    // 1. Garante campos name, icon e color em budgets
    if (!budgetsCol.fields.getByName('name')) {
      budgetsCol.fields.add(
        new Field({
          type: 'text',
          name: 'name',
          required: false,
        }),
      )
    }

    if (!budgetsCol.fields.getByName('icon')) {
      budgetsCol.fields.add(
        new Field({
          type: 'text',
          name: 'icon',
          required: false,
        }),
      )
    }

    if (!budgetsCol.fields.getByName('color')) {
      budgetsCol.fields.add(
        new Field({
          type: 'text',
          name: 'color',
          required: false,
        }),
      )
    }

    // 2. Remove a obrigatoriedade do campo category em budgets
    const catField = budgetsCol.fields.getByName('category')
    if (catField) {
      catField.required = false
    }

    try {
      app.save(budgetsCol)
      console.log('[migration 0032] Schema da coleção budgets atualizado com sucesso')
    } catch (saveErr) {
      console.log('[migration 0032] Erro ao salvar schema de budgets:', saveErr)
    }

    // 3. Migra os dados e limpa o campo category de todas as caixinhas
    let allBudgets = []
    try {
      allBudgets = app.findRecordsByFilter('budgets', '', '-created', 1000, 0)
    } catch (bErr) {
      console.log('[migration 0032] Erro ao buscar budgets:', bErr)
    }

    let allCats = []
    try {
      allCats = app.findRecordsByFilter('categories', '', '', 500, 0)
    } catch (_) {}

    const catMap = {}
    for (let c = 0; c < allCats.length; c++) {
      catMap[allCats[c].id] = allCats[c]
    }

    for (let b = 0; b < allBudgets.length; b++) {
      const budget = allBudgets[b]
      const oldCatId = budget.getString('category')
      const currentName = budget.getString('name')
      const currentIcon = budget.getString('icon')
      const currentColor = budget.getString('color')

      if (oldCatId && catMap[oldCatId]) {
        const catRec = catMap[oldCatId]
        if (!currentName) {
          budget.set('name', catRec.getString('name') || 'Caixinha')
        }
        if (!currentIcon) {
          budget.set('icon', catRec.getString('icon') || 'pet-cat')
        }
        if (!currentColor) {
          budget.set('color', catRec.getString('color') || '#64748b')
        }
      } else if (!currentName) {
        budget.set('name', 'Caixinha')
        budget.set('icon', 'pet-cat')
        budget.set('color', '#64748b')
      }

      // Limpa category
      budget.set('category', null)

      try {
        app.save(budget)
      } catch (err) {
        console.log(`[migration 0032] Erro ao limpar category do budget ${budget.id}:`, err)
      }
    }

    console.log(`[migration 0032] Processados ${allBudgets.length} budgets; campo category zerado.`)
  },
  (app) => {
    // Reversão
  },
)
