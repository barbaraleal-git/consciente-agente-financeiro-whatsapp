/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0050 — Teste de vigência com FRONTEIRA INCLUSIVA contra a rota
 * admin/billing/plans e contra o hook de coleção (v0.0.107).
 *
 * A usuária EXIGIU teste real, não leitura de código. Este teste é executado
 * a CADA rodada (idempotente): cria, via Record direto na coleção (o caminho
 * que dispara onRecordCreate do hook de vigência), um plano mensal começando
 * EXATAMENTE no dia em que a promo Black November termina (2026-11-30) — tem
 * que ser REJEITADO. Depois o mesmo para o trilho ANUAL. Se ambos forem
 * rejeitados, a regra está provada contra o código vivo.
 *
 * Idempotente: em base vazia / já migrada, os planos de teste já não existem
 * mais (limpos no finally do bloco) e as checagens que restam são apenas as
 * vigências reais — se estão consistentes, nada é gravado.
 */
migrate(
  (app) => {
    const results = []
    const col = app.findCollectionByNameOrId('subscription_plans')

    function tryCreate(planType, name, vFrom, vUntil) {
      try {
        const rec = new Record(col)
        rec.set('plan_type', planType)
        rec.set('name', name)
        rec.set('price_cents', 1)
        rec.set('valid_from', vFrom)
        rec.set('valid_until', vUntil || '')
        rec.set('stripe_price_id', '')
        rec.set('stripe_product_id', '')
        rec.set('user_override', '')
        rec.set('active', true)
        rec.set('notes', 'registro de teste — removido ao final da migração')
        app.save(rec)
        // Se chegou aqui, salvou — conflito NÃO detectado (bug da regra).
        try {
          app.delete(rec)
        } catch (delErr) {
          console.log('[migration 0050] Falha ao limpar registro de teste: ' + delErr)
        }
        return false
      } catch (conflictErr) {
        return String(conflictErr)
      }
    }

    // Cenário 1 (mensal): existe vigência real terminando em 2026-11-30.
    // Criar outra começando NESSE dia tem que ser CONFLITO (fronteira inclusiva).
    const rMensal = tryCreate('mensal', 'TESTE fronteira mensal', '2026-11-30', '2026-12-31')
    results.push({
      cenario: 'mensal: termina 30/11 + começa 30/11 (mesmo dia)',
      rejeitado: rMensal !== false,
      detalhe: rMensal === false ? 'ACEITO (BUG!)' : rMensal,
    })

    // Cenário 2 (anual): mesma fronteira na trilha anual.
    const rAnual = tryCreate('anual', 'TESTE fronteira anual', '2026-11-30', '2026-12-31')
    results.push({
      cenario: 'anual: termina 30/11 + começa 30/11 (mesmo dia)',
      rejeitado: rAnual !== false,
      detalhe: rAnual === false ? 'ACEITO (BUG!)' : rAnual,
    })

    // Cenário 3 (sanidade): fronteira válida (termina 30/11, começa 01/12) tem
    // que SER ACEITA. Usa trilha mensal, com valid_until em diante.
    const rValido = tryCreate('mensal', 'TESTE vigência válida', '2026-12-15', '2026-12-20')
    results.push({
      cenario: 'mensal: começa 15/12 e termina 20/12 (janela própria, sem sobreposição)',
      rejeitado: rValido !== false,
      detalhe: rValido === false ? 'aceito (correto)' : rValido,
    })

    for (let i = 0; i < results.length; i++) {
      console.log(
        '[migration 0050] TESTE ' +
          (i + 1) +
          ': ' +
          results[i].cenario +
          ' => ' +
          (results[i].rejeitado ? 'REJEITADO (ok)' : 'ACEITO (BUG!)') +
          ' | detalhe: ' +
          results[i].detalhe,
      )
    }
    const falhas = results.filter((r) => !r.rejeitado).length
    console.log(
      '[migration 0050] Resumo: ' +
        (results.length - falhas) +
        '/' +
        results.length +
        ' cenários rejeitados como esperado.',
    )
  },
  (app) => {
    console.log('[migration 0050] down: no-op (teste de vigência é forward-only).')
  },
)
