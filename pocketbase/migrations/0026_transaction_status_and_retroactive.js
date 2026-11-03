/// <reference path="../pb_data/types.d.ts" />

/**
 * LOTE 4 — Confiabilidade dos lançamentos (itens 27/23/28 do backlog)
 *
 * MIGRAÇÃO PERMANENTE E IDEMPOTENTE (nunca ad-hoc temporária):
 * 1. transactions.status ('active' | 'cancelled' | 'deleted') — deleção LÓGICA.
 *    Nada é apagado fisicamente dali para frente; histórico sempre auditável.
 * 2. transactions.is_retroactive — lançamento com data INFORMADA pelo cliente
 *    diferente da data de processamento/registro na base (item 28).
 * 3. whatsapp_contacts.pending_cancel — contexto do fluxo seguro de
 *    cancelar/substituir lançamento via WhatsApp (item 23).
 * O backfill de 'active' roda em TODA aplicação (select por condição, no-op
 * em base vazia) — nunca depende de executar uma única vez.
 */

migrate(
  (app) => {
    // ---------- 1. transactions.status ----------
    let txCol
    try {
      txCol = app.findCollectionByNameOrId('transactions')
    } catch (e) {
      console.log('[migration 0026] coleção transactions não encontrada:', e)
      return
    }

    if (!txCol.fields.getByName('status')) {
      const statusField = new Field({
        type: 'select',
        name: 'status',
        required: false,
        maxSelect: 1,
        values: ['active', 'cancelled', 'deleted'],
      })
      txCol.fields.add(statusField)
      app.save(txCol)
      console.log('[migration 0026] campo transactions.status adicionado')
    }

    // ---------- 2. transactions.is_retroactive ----------
    if (!txCol.fields.getByName('is_retroactive')) {
      let txCol2
      try {
        txCol2 = app.findCollectionByNameOrId('transactions')
      } catch (_) {
        txCol2 = txCol
      }
      txCol2.fields.add(new Field({ type: 'bool', name: 'is_retroactive', required: false }))
      app.save(txCol2)
      console.log('[migration 0026] campo transactions.is_retroactive adicionado')
    }

    // Backfill idempotente: todo lançamento sem status vira 'active'.
    // Roda por condição — é no-op em base vazia e pode rodar quantas vezes for preciso.
    try {
      const pendentes = app.findRecordsByFilter(
        'transactions',
        "status = '' || status = null",
        '',
        500,
        0,
      )
      let fixed = 0
      for (let i = 0; i < pendentes.length; i++) {
        try {
          pendentes[i].set('status', 'active')
          app.save(pendentes[i])
          fixed++
        } catch (e) {
          console.log('[migration 0026] erro ao ativar transação:', e)
        }
      }
      console.log('[migration 0026] transações marcadas como active nesta leva:', fixed)
    } catch (e) {
      console.log('[migration 0026] backfill de status concluído com aviso:', e)
    }

    // ---------- 3. whatsapp_contacts.pending_cancel ----------
    let wCol
    try {
      wCol = app.findCollectionByNameOrId('whatsapp_contacts')
    } catch (e) {
      console.log('[migration 0026] coleção whatsapp_contacts não encontrada:', e)
      wCol = null
    }
    if (wCol && !wCol.fields.getByName('pending_cancel')) {
      wCol.fields.add(new Field({ type: 'json', name: 'pending_cancel', required: false }))
      app.save(wCol)
      console.log('[migration 0026] campo whatsapp_contacts.pending_cancel adicionado')
    }
  },
  (app) => {
    // Revert: nada a desfazer — campos permanecem (deleção lógica é permanente).
  },
)
