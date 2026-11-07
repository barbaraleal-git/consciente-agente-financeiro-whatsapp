/// <reference path="../pb_data/types.d.ts" />
/**
 * Migration 0037 — Dados legais da empresa com a razão social correta.
 *
 * O registro seed da migração 0036 criou a razão social genérica
 * "Consciente Gestão Financeira Inteligente Ltda." — a razão social
 * real da empresa é "BFL Soluções em Tecnologia". Esta migração é
 * idempotente: só grava quando o valor antigo (seed) está presente,
 * preservando qualquer edição já feita pela administração.
 */
migrate(
  (app) => {
    try {
      const records = app.findRecordsByFilter('company_legal_info', '', '-created', 1, 0)
      if (records.length === 0) return

      const rec = records[0]
      const current = rec.getString('company_name')
      if (current === 'Consciente Gestão Financeira Inteligente Ltda.') {
        rec.set('company_name', 'BFL Soluções em Tecnologia')
        app.save(rec)
        console.log('[migration 0037] Razão social atualizada para BFL Soluções em Tecnologia.')
      } else {
        console.log('[migration 0037] Razão social já editada (' + current + '), preservada.')
      }
    } catch (err) {
      console.log('[migration 0037] Erro ao atualizar dados legais: ' + err)
    }
  },
  (app) => {
    // Reversão: retorna ao valor seed (apenas se ainda for o valor corrigido)
    try {
      const records = app.findRecordsByFilter('company_legal_info', '', '-created', 1, 0)
      if (records.length === 0) return
      const rec = records[0]
      if (rec.getString('company_name') === 'BFL Soluções em Tecnologia') {
        rec.set('company_name', 'Consciente Gestão Financeira Inteligente Ltda.')
        app.save(rec)
      }
    } catch (_) {}
  },
)
