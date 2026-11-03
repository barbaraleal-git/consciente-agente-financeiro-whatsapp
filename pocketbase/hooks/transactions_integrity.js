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
