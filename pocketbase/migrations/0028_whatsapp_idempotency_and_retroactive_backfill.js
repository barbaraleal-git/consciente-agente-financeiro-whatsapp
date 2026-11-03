/// <reference path="../pb_data/types.d.ts" />

/**
 * LOTE 4.1 — Confiabilidade, Idempotência e Correção de Status/Retroativo
 *
 * 1. Cria coleção 'whatsapp_processed_messages' para registrar wamid (Meta message id)
 *    e garantir deduplicação estrita de reenvios da Meta (idempotência do webhook).
 * 2. Backfill em 'transactions':
 *    - Todas as transações com status vazio ou nulo passam para 'active'.
 *    - Transações cuja data difere da data da mensagem (ou da data de criação) são
 *      marcadas com is_retroactive = true (incluindo o caso reportado wiaf14u0zycmccz).
 */

migrate(
  (app) => {
    // ---------- 1. Coleção whatsapp_processed_messages ----------
    let processedCol = null
    try {
      processedCol = app.findCollectionByNameOrId('whatsapp_processed_messages')
    } catch (_) {
      processedCol = null
    }

    if (!processedCol) {
      const col = new Collection({
        name: 'whatsapp_processed_messages',
        type: 'base',
        listRule: "@request.auth.role = 'admin'",
        viewRule: "@request.auth.role = 'admin'",
        createRule: null, // Apenas backend/hooks criam
        updateRule: null,
        deleteRule: "@request.auth.role = 'admin'",
        fields: [
          {
            name: 'message_id',
            type: 'text',
            required: true,
          },
          {
            name: 'phone',
            type: 'text',
            required: false,
          },
          {
            name: 'msg_type',
            type: 'text',
            required: false,
          },
          {
            name: 'raw_timestamp',
            type: 'text',
            required: false,
          },
          {
            name: 'created',
            type: 'autodate',
            onCreate: true,
            onUpdate: false,
          },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_wamid_unique ON whatsapp_processed_messages (message_id)',
          'CREATE INDEX idx_wamid_created ON whatsapp_processed_messages (created)',
        ],
      })
      app.save(col)
      console.log('[migration 0028] Coleção whatsapp_processed_messages criada com sucesso')
    }

    // ---------- 2. Backfill de status='active' e is_retroactive ----------
    try {
      const allTx = app.findRecordsByFilter('transactions', '', '-created', 500, 0)
      let statusFixed = 0
      let retroFixed = 0

      for (let i = 0; i < allTx.length; i++) {
        const tx = allTx[i]
        let changed = false

        // Status vazio/nulo vira 'active'
        const currentStatus = tx.getString('status')
        if (!currentStatus) {
          tx.set('status', 'active')
          changed = true
          statusFixed++
        }

        // Verifica se a transação é retroativa:
        // tx.date (YYYY-MM-DD) vs message_timestamp (YYYY-MM-DD) ou tx.created (YYYY-MM-DD)
        const txDateRaw = tx.getString('date')
        const txDate = txDateRaw ? txDateRaw.slice(0, 10) : ''
        const msgTs = tx.getString('message_timestamp')
        const refDate = msgTs ? msgTs.slice(0, 10) : tx.getString('created').slice(0, 10)

        const currentRetro = tx.getBool('is_retroactive')
        if (txDate && refDate && txDate !== refDate && !currentRetro) {
          tx.set('is_retroactive', true)
          changed = true
          retroFixed++
        }

        if (changed) {
          try {
            app.save(tx)
          } catch (saveErr) {
            console.log('[migration 0028] Erro ao salvar transação ' + tx.id + ':', saveErr)
          }
        }
      }

      console.log(
        `[migration 0028] Backfill concluído: status corrigidos=${statusFixed}, retroativos corrigidos=${retroFixed}`,
      )
    } catch (bfErr) {
      console.log('[migration 0028] Erro no backfill de transactions:', bfErr)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('whatsapp_processed_messages')
      if (col) {
        app.delete(col)
      }
    } catch (_) {}
  },
)
