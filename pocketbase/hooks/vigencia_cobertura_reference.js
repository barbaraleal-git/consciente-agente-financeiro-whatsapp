/// <reference path="../pb_data/types.d.ts" />

/**
 * REFERÊNCIA LEGÍVEL (v0.0.115) — NÃO é hook executável.
 *
 * Este arquivo existe apenas como referência legível da FALLBACK 100% inline
 * da função de cobertura contínua por trilha, usada em:
 *   - pocketbase/hooks/subscription_plans_vigencia.js (onRecordCreate /
 *     onRecordUpdate da coleção subscription_plans), e
 *   - pocketbase/hooks/billing_stripe.js (rota POST /backend/v1/admin/billing/plans).
 *
 * A FONTE ÚNICA da lógica continua sendo globalThis.__vigenciaCobertura,
 * registrada por subscription_plans_vigencia.js. Como a JSVM do PocketBase NÃO
 * compartilha o globalThis de forma confiável entre módulos/hooks em todos os
 * pools de VM (bug real: "Object has no member '__vigenciaCobertura'", v0.0.114),
 * cada CONSUMIDOR carrega uma cópia 100% inline desta mesma lógica como fallback
 * (resolução defensiva com typeof + try). Qualquer alteração na regra deve ser
 * feita em subscription_plans_vigencia.js e REPLICADA nos fallbacks inline.
 *
 * IMPORTANTE (deploy): hook filenames devem começar com LETRA (slug válido) —
 * a versão anterior deste arquivo com prefixo "_" ("_vigencia_...") quebrava o
 * deploy com "invalid slug". Para não depender de nome de arquivo, esta cópia
 * de referência vive agora como COMENTÁRIO; o arquivo não registra nada.
 *
 * Lógica de referência (identical aos fallbacks inline v0.0.115):
 *
 * function vigenciaCobertura(planType, rows) {
 *   var today = new Date().toISOString().slice(0, 10)
 *   // 1. Filtra e normaliza: só janelas com from; janelas totalmente passadas
 *   //    (until < hoje) saem; as demais entram com from >= hoje.
 *   var intervals = []
 *   for (var i = 0; i < rows.length; i++) {
 *     var r = rows[i]
 *     if (!r.from) continue
 *     if (r.until && r.until < today) continue
 *     intervals.push({ from: r.from > today ? r.from : today, until: r.until || '' })
 *   }
 *   if (intervals.length === 0) {
 *     return 'A trilha ' + planType + ' ficaria SEM nenhum plano ativo a partir de hoje (' +
 *       today + ') — nenhuma data futura pode ficar sem plano definido: um cliente que
 *       chegar para se cadastrar não encontraria plano disponível.'
 *   }
 *   // 2. Ordena por from (strings ISO ordenam lexicograficamente).
 *   intervals.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0 })
 *   // 3. Varre a linha do tempo: cursor = primeiro dia SEM plano garantido.
 *   var cursor = ''
 *   for (var j = 0; j < intervals.length; j++) {
 *     var iv = intervals[j]
 *     if (cursor === '') {
 *       if (iv.from > today) {
 *         return 'A trilha ' + planType + ' ficaria SEM nenhum plano ativo de hoje (' +
 *           today + ') até ' + iv.from + ' — ... Inicie a nova vigência em ' + today + ' ou antes.'
 *       }
 *     } else if (iv.from > cursor) {
 *       return 'A trilha ' + planType + ' ficaria SEM cobertura entre ' + cursor + ' e ' +
 *         iv.from + ' — ... (ex.: uma termina 30/11 e a próxima começa 01/12).'
 *     }
 *     if (iv.until === '') { cursor = '' } else if (cursor === '' || iv.until > cursor) { cursor = iv.until }
 *   }
 *   if (cursor === '') { return '' }
 *   return 'A trilha ' + planType + ' terminaria em ' + cursor + ' e ficaria SEM cobertura a
 *     partir do dia seguinte — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante)...'
 * }
 */
