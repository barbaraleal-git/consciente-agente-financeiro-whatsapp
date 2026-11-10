/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Assinaturas, Cobrança Recorrente (Stripe Direta via $http), Webhook e Sincronização.
 *
 * Arquitetura e Regras JSVM do PocketBase:
 * 1. ZERO declarações top-level referenciadas dentro de callbacks!
 *    O PocketBase executa callbacks em pools de VMs isoladas. TODAS as funções auxiliares
 *    devem ser declaradas 100% INLINE dentro do corpo de cada callback routerAdd.
 * 2. Integração DIRETA com a API REST da Stripe (https://api.stripe.com/v1) via $http.send:
 *    - Credenciais armazenadas na coleção `stripe_config` (secret_key, webhook_signing_secret, price_id_mensal, price_id_anual).
 *    - Chave secreta enviada via Authorization Bearer (base64Encode não existe na JSVM).
 *    - A chave NUNCA é enviada em texto claro ao cliente: mascarada na leitura admin (sk_live_***abc) e nunca logada.
 *    - Se `stripe_config` estiver sem secret_key, retorna 400 amigável orientando Backoffice Admin (sem 500 cru).
 *    - CORPO DA RESPOSTA $http.send: { statusCode, headers, cookies, body (bytes), raw (texto), json (parseado) }.
 *      res.rawText NÃO existe — usar res.json (parseado) ou res.raw (texto); JSON.parse(res.rawText||'{}') causava
 *      o 502 "undefined" no checkout (status 200 da Stripe lido como corpo indefinido).
 * 3. Rotas criadas:
 *    - GET  /backend/v1/billing/status (dados da assinatura, dados legais e planos vigentes)
 *    - POST /backend/v1/billing/create-checkout-session (cria Checkout Session na Stripe via $http)
 *    - POST /backend/v1/billing/create-portal-session (cria Portal Session na Stripe via $http)
 *    - POST /backend/v1/billing/sync-session (sincroniza manualmente via session_id)
 *    - POST /backend/v1/billing/cancel-subscription (cancela assinatura na Stripe via $http)
 *    - POST /backend/v1/billing/update-profile (atualiza dados cadastrais)
 *    - POST /backend/v1/stripe/webhook (webhook público Stripe com validação de Stripe-Signature)
 *    - GET  /backend/v1/admin/billing/stripe-config (leitura de config Stripe para admin, mascarada)
 *    - POST /backend/v1/admin/billing/stripe-config (gravação de config Stripe por admin)
 *    - GET  /backend/v1/admin/billing/plans (lista planos e overrides)
 *    - POST /backend/v1/admin/billing/plans (cria ou atualiza plano/override)
 *    - POST /backend/v1/admin/billing/legal-info (atualiza dados legais da empresa)
 *    - GET  /backend/v1/admin/billing/subscriptions (visão de clientes e assinaturas)
 */

// ----------------------------------------------------
// 1. GET /backend/v1/billing/status
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/billing/status',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      function inlineGetLegal() {
        try {
          const records = $app.findRecordsByFilter('company_legal_info', '', '-created', 1, 0)
          if (records.length > 0) {
            const r = records[0]
            return {
              id: r.id,
              company_name: r.getString('company_name'),
              trade_name: r.getString('trade_name'),
              cnpj: r.getString('cnpj'),
              address_full: r.getString('address_full'),
              email_contact: r.getString('email_contact'),
              support_phone_or_bot: r.getString('support_phone_or_bot'),
              terms_version: r.getString('terms_version') || 'v1.0',
              privacy_version: r.getString('privacy_version') || 'v1.0',
              trial_days_default: r.getInt('trial_days_default') || 7,
              carencia_days_default: r.getInt('carencia_days_default') || 7,
            }
          }
        } catch (err) {
          console.log('[billing] Erro ao buscar company_legal_info: ' + err)
        }
        return {
          company_name: 'BFL Soluções em Tecnologia',
          trade_name: 'Consciente - Seu parceiro nas finanças',
          cnpj: '53.842.190/0001-38',
          address_full: 'Av. Paulista, 1000, Bela Vista, São Paulo - SP, CEP 01310-100',
          email_contact: 'contato@consciente.app.br',
          support_phone_or_bot: '+55 (11) 94998-9868',
          terms_version: 'v1.0',
          privacy_version: 'v1.0',
          trial_days_default: 7,
          carencia_days_default: 7,
        }
      }

      function inlineResolvePlan(userId, planType) {
        const today = new Date().toISOString().slice(0, 10)
        try {
          if (userId) {
            const overrides = $app.findRecordsByFilter(
              'subscription_plans',
              "user_override = '" + userId + "' && plan_type = '" + planType + "' && active = true",
              '-created',
              5,
              0,
            )
            for (let i = 0; i < overrides.length; i++) {
              const o = overrides[i]
              const vFrom = o.getString('valid_from') || ''
              const vUntil = o.getString('valid_until') || ''
              if ((!vFrom || vFrom <= today) && (!vUntil || vUntil >= today)) {
                return {
                  id: o.id,
                  plan_type: o.getString('plan_type'),
                  name: o.getString('name'),
                  price_cents: o.getInt('price_cents'),
                  stripe_price_id: o.getString('stripe_price_id'),
                  stripe_product_id: o.getString('stripe_product_id'),
                  is_override: true,
                }
              }
            }
          }

          const plans = $app.findRecordsByFilter(
            'subscription_plans',
            "user_override = null && plan_type = '" + planType + "' && active = true",
            '-created',
            20,
            0,
          )
          for (let i = 0; i < plans.length; i++) {
            const p = plans[i]
            const vFrom = p.getString('valid_from') || ''
            const vUntil = p.getString('valid_until') || ''
            if ((!vFrom || vFrom <= today) && (!vUntil || vUntil >= today)) {
              return {
                id: p.id,
                plan_type: p.getString('plan_type'),
                name: p.getString('name'),
                price_cents: p.getInt('price_cents'),
                stripe_price_id: p.getString('stripe_price_id'),
                stripe_product_id: p.getString('stripe_product_id'),
                is_override: false,
              }
            }
          }
        } catch (err) {
          console.log('[billing] Erro ao resolver plano: ' + err)
        }

        if (planType === 'anual') {
          return {
            id: '',
            plan_type: 'anual',
            name: 'Anual (Black November)',
            price_cents: 21490,
            stripe_price_id: '',
            stripe_product_id: '',
            is_override: false,
          }
        }
        return {
          id: '',
          plan_type: 'mensal',
          name: 'Mensal (Black November)',
          price_cents: 1990,
          stripe_price_id: '',
          stripe_product_id: '',
          is_override: false,
        }
      }

      const userRec = $app.findRecordById('_pb_users_auth_', authUser.id)
      const subStatus = userRec.getString('subscription_status') || 'trial'
      const subPlan = userRec.getString('subscription_plan') || 'mensal'
      const subExpires = userRec.getString('subscription_expires_at') || ''
      const carenciaUntil = userRec.getString('carencia_until') || ''
      const accessUntilRaw = userRec.getString('access_until') || ''
      const customerId = userRec.getString('stripe_customer_id') || ''
      const subId = userRec.getString('stripe_subscription_id') || ''

      // PLANO ANUAL VIA PIX (pagamento único): conta 'active' SEM assinatura
      // recorrente (sem stripe_subscription_id) mas com access_until gravado.
      // Quando a validade de 12 meses expira, a conta volta a não-assinante:
      // status 'cancelado' com access_until já passado (fluxo de reassinatura).
      // O 'active' RECURRENTE (com subId) nunca passa por aqui.
      // IMPORTANTE (padrão JSVM/v0.0.66): declarações usadas em vários blocos
      // ficam ANTES de qualquer try{} — const dentro de try tem escopo do bloco.
      const accessUntilValid =
        accessUntilRaw !== '' && new Date(accessUntilRaw).getTime() > Date.now()
      let effectiveStatus = subStatus
      if (subStatus === 'active' && !subId && accessUntilRaw && !accessUntilValid) {
        effectiveStatus = 'cancelado'
        try {
          userRec.set('subscription_status', 'cancelado')
          $app.save(userRec)
          const histCol = $app.findCollectionByNameOrId('subscriptions_history')
          const histRec = new Record(histCol)
          histRec.set('user', userRec.id)
          histRec.set('event_type', 'billing.one_time_expired')
          histRec.set('plan_type', subPlan)
          histRec.set('status_from', 'active')
          histRec.set('status_to', 'cancelado')
          histRec.set('details', { reason: 'access_until do pagamento único expirou' })
          $app.save(histRec)
        } catch (otErr) {
          console.log('[billing] Erro ao expirar pagamento único: ' + otErr)
        }
      }

      // Blindagem anti-fantasma: 'active' só é aceito se houver evidência real
      // de pagamento na Stripe (assinatura OU customer criado no checkout).
      // Um 'active' gravado sem evidência (seed/demo) é rebaixado para 'trial'
      // — a ativação real acontece SOMENTE via webhook checkout.session.completed
      // ou sync-session, que gravam stripe_subscription_id.
      // EXCEÇÃO — PLANO ANUAL VIA PIX (pagamento único): 'active' SEM
      // stripe_subscription_id MAS com access_until válido é o pagamento único
      // anual, e NUNCA deve ser rebaixado (só o bloco de expiração acima o
      // rebaixa, quando access_until passa).
      // Um registro 'cancelado' com access_until no futuro é um cliente que
      // cancelou mas ainda está dentro do período já pago: ele mantém acesso
      // total até essa data e NUNCA deve ser rebaixado pela blindagem
      // (a blindagem só rebaixa 'active' fantasma, nunca 'cancelado').
      try {
        if (subStatus === 'active' && !subId && !customerId && !accessUntilValid) {
          effectiveStatus = 'trial'
          userRec.set('subscription_status', 'trial')
          const trialDays = 7
          const trialUntil = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
          userRec.set('subscription_expires_at', trialUntil)
          $app.save(userRec)
          console.log(
            '[billing] Status active sem evidencia Stripe (seed/demo). Usuario ' +
              userRec.id +
              ' rebaixado para trial.',
          )
          try {
            const histCol = $app.findCollectionByNameOrId('subscriptions_history')
            const histRec = new Record(histCol)
            histRec.set('user', userRec.id)
            histRec.set('event_type', 'billing.fix.ghost_active_to_trial')
            histRec.set('plan_type', subPlan)
            histRec.set('status_from', 'active')
            histRec.set('status_to', 'trial')
            histRec.set('details', {
              reason: 'status active sem stripe_subscription_id e sem stripe_customer_id',
            })
            $app.save(histRec)
          } catch (hErr) {
            console.log('[billing] Falha ao registrar subscriptions_history: ' + hErr)
          }
        }
      } catch (gErr) {
        console.log('[billing] Erro na blindagem anti-fantasma: ' + gErr)
      }

      const legal = inlineGetLegal()
      const planMensal = inlineResolvePlan(userRec.id, 'mensal')
      const planAnual = inlineResolvePlan(userRec.id, 'anual')

      const nowIso = new Date().toISOString()
      if (subStatus === 'carencia' && carenciaUntil && nowIso > carenciaUntil) {
        effectiveStatus = 'bloqueado'
        try {
          userRec.set('subscription_status', 'bloqueado')
          $app.save(userRec)
        } catch (_) {}
      }

      return e.json(200, {
        status: effectiveStatus,
        plan: subPlan,
        expires_at: subExpires,
        carencia_until: carenciaUntil,
        access_until: accessUntilRaw,
        access_active: accessUntilValid && effectiveStatus !== 'bloqueado',
        has_stripe_customer: !!customerId,
        has_stripe_subscription: !!subId,
        user_info: {
          id: userRec.id,
          name: userRec.getString('name') || '',
          full_name: userRec.getString('full_name') || '',
          email: userRec.getString('email') || '',
          cpf: userRec.getString('cpf') || '',
          birth_date: userRec.getString('birth_date') || '',
          phone: userRec.getString('phone') || '',
          address: {
            zip_code: userRec.getString('zip_code') || '',
            street: userRec.getString('street') || '',
            number: userRec.getString('number') || '',
            complement: userRec.getString('complement') || '',
            neighborhood: userRec.getString('neighborhood') || '',
            city: userRec.getString('city') || '',
            state: userRec.getString('state') || '',
          },
          terms_accepted_at: userRec.getString('terms_accepted_at') || '',
          recurring_consent_accepted_at: userRec.getString('recurring_consent_accepted_at') || '',
        },
        plans: {
          mensal: planMensal,
          anual: planAnual,
        },
        legal_info: legal,
      })
    } catch (err) {
      console.log('[billing] Erro em /status: ' + err)
      return e.json(500, { error: 'Não foi possível carregar o status da assinatura.' })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 2. POST /backend/v1/billing/create-checkout-session
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/billing/create-checkout-session',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      function inlineGetStripeConfig() {
        try {
          const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
          if (records.length > 0) {
            const r = records[0]
            return {
              id: r.id,
              secret_key: (r.getString('secret_key') || '').trim(),
              webhook_signing_secret: (r.getString('webhook_signing_secret') || '').trim(),
              price_id_mensal: (r.getString('price_id_mensal') || '').trim(),
              price_id_anual: (r.getString('price_id_anual') || '').trim(),
            }
          }
        } catch (err) {
          console.log('[billing] Erro ao carregar stripe_config: ' + err)
        }
        return null
      }

      function inlineStripeRequest(secretKey, method, path, formParams) {
        const url = 'https://api.stripe.com/v1' + path
        const authHeader = 'Bearer ' + secretKey
        const headers = {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
        let bodyStr = ''
        if (formParams && typeof formParams === 'object') {
          const pairs = []
          for (let k in formParams) {
            if (Object.prototype.hasOwnProperty.call(formParams, k)) {
              const v = formParams[k]
              if (v !== undefined && v !== null && v !== '') {
                pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
              }
            }
          }
          bodyStr = pairs.join('&')
        }

        const res = $http.send({
          url: url,
          method: method,
          headers: headers,
          body: bodyStr || undefined,
          timeout: 30,
        })

        // Resposta da $http.send na JSVM: { statusCode, headers, cookies, body (bytes), raw (texto), json (parseado) }.
        // res.rawText NÃO existe (undefined) — era a causa do 502 no checkout com status 200 da Stripe.
        let data = null
        try {
          if (res.json && typeof res.json === 'object') {
            data = res.json
          } else {
            const rawStr = res.raw || ''
            if (rawStr) {
              try {
                data = JSON.parse(rawStr)
              } catch (_) {
                data = null
              }
            }
          }
        } catch (pErr) {
          console.log('[billing] Erro ao parsear resposta Stripe: ' + pErr)
          data = null
        }

        // Diagnóstico temporário: quando não conseguimos extrair corpo, imprime as chaves do objeto
        if (!data) {
          try {
            const keys = []
            for (let k in res) keys.push(k + '=' + typeof res[k])
            console.log(
              '[billing][diag] Resposta $http.send sem corpo legível. Chaves: ' +
                keys.join(', ') +
                ' | raw: ' +
                String(res.raw || '').slice(0, 500),
            )
          } catch (dErr) {
            console.log('[billing][diag] Falha ao inspecionar resposta: ' + dErr)
          }
        }

        return {
          statusCode: res.statusCode,
          data: data,
          rawText: res.raw || '',
        }
      }

      function inlineResolvePlan(userId, planType, config) {
        const today = new Date().toISOString().slice(0, 10)
        let resolved = {
          id: '',
          plan_type: planType,
          name: planType === 'anual' ? 'Anual (Black November)' : 'Mensal (Black November)',
          price_cents: planType === 'anual' ? 21490 : 1990,
          stripe_price_id: '',
          stripe_product_id: '',
          is_override: false,
        }

        try {
          if (userId) {
            const overrides = $app.findRecordsByFilter(
              'subscription_plans',
              "user_override = '" + userId + "' && plan_type = '" + planType + "' && active = true",
              '-created',
              5,
              0,
            )
            for (let i = 0; i < overrides.length; i++) {
              const o = overrides[i]
              const vFrom = o.getString('valid_from') || ''
              const vUntil = o.getString('valid_until') || ''
              if ((!vFrom || vFrom <= today) && (!vUntil || vUntil >= today)) {
                resolved = {
                  id: o.id,
                  plan_type: o.getString('plan_type'),
                  name: o.getString('name'),
                  price_cents: o.getInt('price_cents'),
                  stripe_price_id: o.getString('stripe_price_id'),
                  stripe_product_id: o.getString('stripe_product_id'),
                  is_override: true,
                }
                break
              }
            }
          }

          if (!resolved.id) {
            const plans = $app.findRecordsByFilter(
              'subscription_plans',
              "user_override = null && plan_type = '" + planType + "' && active = true",
              '-created',
              20,
              0,
            )
            for (let i = 0; i < plans.length; i++) {
              const p = plans[i]
              const vFrom = p.getString('valid_from') || ''
              const vUntil = p.getString('valid_until') || ''
              if ((!vFrom || vFrom <= today) && (!vUntil || vUntil >= today)) {
                resolved = {
                  id: p.id,
                  plan_type: p.getString('plan_type'),
                  name: p.getString('name'),
                  price_cents: p.getInt('price_cents'),
                  stripe_price_id: p.getString('stripe_price_id'),
                  stripe_product_id: p.getString('stripe_product_id'),
                  is_override: false,
                }
                break
              }
            }
          }
        } catch (err) {
          console.log('[billing] Erro ao resolver plano: ' + err)
        }

        // Se o plano ainda não tem stripe_price_id mas stripe_config tem o price_id correspondente, usa-o
        if (!resolved.stripe_price_id && config) {
          if (planType === 'mensal' && config.price_id_mensal) {
            resolved.stripe_price_id = config.price_id_mensal
          } else if (planType === 'anual' && config.price_id_anual) {
            resolved.stripe_price_id = config.price_id_anual
          }
        }

        return resolved
      }

      const stripeCfg = inlineGetStripeConfig()
      if (!stripeCfg || !stripeCfg.secret_key) {
        return e.json(400, {
          error:
            'O pagamento ainda não está configurado. Conclua a configuração no Backoffice Admin.',
          code: 'STRIPE_NOT_CONFIGURED',
        })
      }

      const body = e.requestInfo().body || {}
      const planType = body.plan_type === 'anual' ? 'anual' : 'mensal'
      // ANUAL VIA PIX (pagamento único): contas Stripe domiciliadas no Brasil não
      // oferecem Pix recorrente — o plano anual passa a ser cobrado como
      // one-time (mode=payment), com cartão+Pix habilitados no mesmo checkout.
      // A assinatura MENSAL permanece mode=subscription (cartão recorrente).
      const billingMode = body.billing_mode === 'one_time' ? 'one_time' : 'recurring'
      if (billingMode === 'one_time' && planType !== 'anual') {
        return e.json(400, { error: 'Pagamento único está disponível apenas no plano anual.' })
      }
      const appOrigin = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'

      // UX pós-checkout: o cliente SEMPRE volta para o MESMO front de onde
      // saiu, preservando a sessão local do PocketBase (authStore). URLs de
      // retorno são aceitas apenas de hosts na allowlist (*.goskip.app, o
      // próprio backend, localhost) — host desconhecido cai no fallback do
      // front de produção, nunca num domínio arbitrário (open redirect) nem
      // num host sem sessão (que forçaria a tela de login).
      let requestHost = ''
      try {
        requestHost = String(e.request.header.get('Host') || '').toLowerCase()
      } catch (_) {}
      const isAllowedReturnUrl = function (url) {
        const s = String(url || '')
        if (s.indexOf('https://') !== 0 && s.indexOf('http://') !== 0) return false
        const host = s
          .slice(s.indexOf('://') + 3)
          .split('/')[0]
          .split(':')[0]
          .toLowerCase()
        if (!host) return false
        if (requestHost && host === requestHost) return true
        if (host.indexOf('localhost') === 0 || host.indexOf('127.0.0.1') === 0) return true
        if (host === 'agente-financeiro-whatsapp-37fd3.goskip.app') return true
        if (host.length > 11 && host.slice(-11) === '.goskip.app') return true
        return false
      }
      if (body.success_url && !isAllowedReturnUrl(body.success_url)) {
        console.log(
          '[billing] success_url fora da allowlist, usando fallback do front de produção: ' +
            body.success_url,
        )
      }
      const successUrl =
        body.success_url && isAllowedReturnUrl(body.success_url)
          ? body.success_url
          : appOrigin +
            '/settings?section=assinatura&checkout=success&session_id={CHECKOUT_SESSION_ID}'
      const cancelUrl =
        body.cancel_url && isAllowedReturnUrl(body.cancel_url)
          ? body.cancel_url
          : appOrigin + '/settings?section=assinatura&checkout=cancelled'

      const userRec = $app.findRecordById('_pb_users_auth_', authUser.id)
      const userEmail = userRec.getString('email')
      const userName =
        userRec.getString('full_name') || userRec.getString('name') || 'Cliente Consciente'
      const userPhone = userRec.getString('phone') || ''
      let customerId = userRec.getString('stripe_customer_id') || ''

      const resolvedPlan = inlineResolvePlan(userRec.id, planType, stripeCfg)

      // Garante customer na Stripe via API direta se ainda não tiver
      if (!customerId) {
        try {
          const custParams = {
            email: userEmail,
            name: userName,
            description: 'Cliente Consciente ID: ' + userRec.id,
          }
          if (userPhone) custParams['phone'] = userPhone
          custParams['metadata[user_id]'] = userRec.id

          const custRes = inlineStripeRequest(
            stripeCfg.secret_key,
            'POST',
            '/customers',
            custParams,
          )
          if (
            custRes.statusCode >= 200 &&
            custRes.statusCode < 300 &&
            custRes.data &&
            custRes.data.id
          ) {
            customerId = custRes.data.id
            userRec.set('stripe_customer_id', customerId)
            $app.save(userRec)
          } else {
            console.log(
              '[billing] Falha ao criar customer na Stripe (' +
                custRes.statusCode +
                '): ' +
                custRes.rawText,
            )
          }
        } catch (cErr) {
          console.log('[billing] Exceção ao criar customer Stripe: ' + cErr)
        }
      }

      // Parâmetros da Checkout Session em form-encoded
      const sessParams = {
        mode: billingMode === 'one_time' ? 'payment' : 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userRec.id,
        'metadata[user_id]': userRec.id,
        'metadata[plan_type]': planType,
        'metadata[billing_mode]': billingMode,
        'metadata[price_cents]': String(resolvedPlan.price_cents),
      }

      if (customerId) {
        sessParams['customer'] = customerId
      } else if (userEmail) {
        sessParams['customer_email'] = userEmail
      }

      // Pix (pagamento único): habilitado via payment_method_types explícitos
      // no mesmo checkout do cartão. O webhook de checkout.session.completed
      // decide o que fazer pelo metadata.billing_mode (one_time → +12 meses,
      // sem subscription).
      if (billingMode === 'one_time') {
        sessParams['payment_method_types[0]'] = 'card'
        sessParams['payment_method_types[1]'] = 'pix'
      }

      if (billingMode === 'one_time') {
        // DECISÃO (documentada): em mode=payment a Stripe RECUSA price_ com
        // recurring (erro "This price is not usable in payment mode"). Para
        // reutilizar o valor parametrizado (R$ 214,90) sem tocar no price
        // recorrente existente, cobramos com price_data one-time usando
        // unit_amount do plano resolvido (override do Backoffice respeitado).
        sessParams['line_items[0][price_data][currency]'] = 'brl'
        sessParams['line_items[0][price_data][unit_amount]'] = String(resolvedPlan.price_cents)
        sessParams['line_items[0][price_data][product_data][name]'] = resolvedPlan.name
        sessParams['line_items[0][price_data][product_data][description]'] =
          'Plano Anual Consciente — pagamento único (válido por 12 meses)'
        sessParams['line_items[0][quantity]'] = '1'
      } else if (resolvedPlan.stripe_price_id) {
        sessParams['line_items[0][price]'] = resolvedPlan.stripe_price_id
        sessParams['line_items[0][quantity]'] = '1'
      } else {
        const interval = planType === 'anual' ? 'year' : 'month'
        sessParams['line_items[0][price_data][currency]'] = 'brl'
        sessParams['line_items[0][price_data][unit_amount]'] = String(resolvedPlan.price_cents)
        sessParams['line_items[0][price_data][recurring][interval]'] = interval
        sessParams['line_items[0][price_data][product_data][name]'] = resolvedPlan.name
        sessParams['line_items[0][price_data][product_data][description]'] =
          'Assinatura Consciente - Seu parceiro nas finanças'
        sessParams['line_items[0][quantity]'] = '1'
      }

      const sessRes = inlineStripeRequest(
        stripeCfg.secret_key,
        'POST',
        '/checkout/sessions',
        sessParams,
      )

      if (
        sessRes.statusCode < 200 ||
        sessRes.statusCode >= 300 ||
        !sessRes.data ||
        !sessRes.data.url
      ) {
        console.log(
          '[billing] Falha Stripe Checkout (' + sessRes.statusCode + '): ' + sessRes.rawText,
        )
        const stripeErrorMsg =
          (sessRes.data && sessRes.data.error && sessRes.data.error.message) || ''
        // Mensagem amigável em português (o front exibe err.message direto ao usuário)
        let friendlyMsg = 'Não foi possível iniciar o checkout. '
        if (stripeErrorMsg) {
          if (stripeErrorMsg.indexOf('Invalid API key') !== -1) {
            friendlyMsg += 'A Secret Key da Stripe parece inválida. Revise no Backoffice Admin.'
          } else if (stripeErrorMsg.indexOf('No such price') !== -1) {
            friendlyMsg +=
              'O Price ID configurado não existe na Stripe. Revise no Backoffice Admin.'
          } else {
            friendlyMsg += 'Motivo informado pela Stripe: ' + stripeErrorMsg
          }
        } else {
          friendlyMsg += 'Verifique os dados no Backoffice Admin (Billing > Configuração Stripe).'
        }
        return e.json(502, {
          error: friendlyMsg,
          code: 'STRIPE_CHECKOUT_FAILED',
        })
      }
      return e.json(200, {
        session_id: sessRes.data.id,
        url: sessRes.data.url,
        plan: resolvedPlan,
      })
    } catch (err) {
      console.log('[billing] Erro em create-checkout-session: ' + err)
      return e.json(500, {
        error: 'Não foi possível iniciar o checkout. Tente novamente ou fale com o suporte.',
      })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 3. POST /backend/v1/billing/sync-session
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/billing/sync-session',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      function inlineGetStripeConfig() {
        try {
          const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
          if (records.length > 0) {
            const r = records[0]
            return {
              id: r.id,
              secret_key: (r.getString('secret_key') || '').trim(),
            }
          }
        } catch (_) {}
        return null
      }

      function inlineStripeRequest(secretKey, method, path) {
        const url = 'https://api.stripe.com/v1' + path
        const authHeader = 'Bearer ' + secretKey
        const headers = {
          Authorization: authHeader,
        }
        const res = $http.send({
          url: url,
          method: method,
          headers: headers,
          timeout: 30,
        })
        // Corpo da resposta $http.send: res.json (parseado) ou res.raw (texto). res.rawText não existe.
        let parsed = null
        try {
          if (res.json && typeof res.json === 'object') {
            parsed = res.json
          } else {
            const rawStr = res.raw || ''
            if (rawStr) {
              try {
                parsed = JSON.parse(rawStr)
              } catch (_) {
                parsed = null
              }
            }
          }
        } catch (_) {
          parsed = null
        }
        return {
          statusCode: res.statusCode,
          data: parsed,
          rawText: res.raw || '',
        }
      }

      function inlineLogHistory(userId, eventType, data) {
        try {
          const col = $app.findCollectionByNameOrId('subscriptions_history')
          const rec = new Record(col)
          rec.set('user', userId)
          rec.set('event_type', eventType)
          if (data.plan_type) rec.set('plan_type', data.plan_type)
          if (data.amount_cents) rec.set('amount_cents', data.amount_cents)
          if (data.status_from) rec.set('status_from', data.status_from)
          if (data.status_to) rec.set('status_to', data.status_to)
          if (data.stripe_event_id) rec.set('stripe_event_id', data.stripe_event_id)
          if (data.details) rec.set('details', data.details)
          $app.save(rec)
        } catch (hErr) {
          console.log('[billing] Falha ao registrar subscriptions_history: ' + hErr)
        }
      }

      const body = e.requestInfo().body || {}
      const sessionId = body.session_id
      if (!sessionId) {
        return e.json(400, { error: 'session_id obrigatório' })
      }

      const stripeCfg = inlineGetStripeConfig()
      if (!stripeCfg || !stripeCfg.secret_key) {
        return e.json(400, {
          error: 'Configuração Stripe ausente.',
        })
      }

      const res = inlineStripeRequest(
        stripeCfg.secret_key,
        'GET',
        '/checkout/sessions/' + sessionId,
      )
      if (res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
        return e.json(404, {
          error: 'Sessão Stripe não encontrada na API.',
        })
      }

      const sess = res.data
      const paymentStatus = sess.payment_status
      const status = sess.status
      const customerId = sess.customer || ''
      const subId = sess.subscription || ''
      const planType = (sess.metadata && sess.metadata.plan_type) || 'mensal'
      const priceCents = parseInt((sess.metadata && sess.metadata.price_cents) || '1990', 10)
      const isOneTime =
        (sess.metadata && sess.metadata.billing_mode) === 'one_time' || sess.mode === 'payment'

      if (paymentStatus === 'paid' || status === 'complete') {
        const userRec = $app.findRecordById('_pb_users_auth_', authUser.id)
        const oldStatus = userRec.getString('subscription_status')
        userRec.set('subscription_status', 'active')
        userRec.set('subscription_plan', planType)
        if (customerId) userRec.set('stripe_customer_id', customerId)
        // ANUAL VIA PIX (one_time): NUNCA grava stripe_subscription_id —
        // não existe subscription Stripe; a validade fica em access_until.
        if (subId && !isOneTime) userRec.set('stripe_subscription_id', subId)
        userRec.set('carencia_until', '')

        let expiresAt = ''
        if (isOneTime) {
          // Pagamento único anual: 12 meses de acesso a partir de agora.
          expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          userRec.set('access_until', expiresAt)
          userRec.set('subscription_expires_at', expiresAt)
        } else {
          // Reativação: o período de acesso pós-cancelamento deixa de existir.
          userRec.set('access_until', '')
          const addDays = planType === 'anual' ? 365 : 30
          expiresAt = new Date(Date.now() + addDays * 24 * 60 * 60 * 1000).toISOString()
          userRec.set('subscription_expires_at', expiresAt)
        }

        $app.save(userRec)

        inlineLogHistory(userRec.id, 'checkout.completed', {
          plan_type: planType,
          amount_cents: priceCents,
          status_from: oldStatus,
          status_to: 'active',
          stripe_event_id: sessionId,
          details: {
            session_id: sessionId,
            customer_id: customerId,
            subscription_id: isOneTime ? '' : subId,
            billing_mode: isOneTime ? 'one_time' : 'recurring',
            payment_method: (sess.payment_method_types || []).join(','),
          },
        })

        return e.json(200, {
          success: true,
          status: 'active',
          plan: planType,
          expires_at: expiresAt,
          message: isOneTime
            ? 'Plano anual ativado com sucesso (pagamento único)! Acesso garantido por 12 meses.'
            : 'Assinatura ativada com sucesso! Seu Consciente no WhatsApp já está liberado.',
        })
      }

      return e.json(200, {
        success: false,
        payment_status: paymentStatus,
        status: status,
        message: 'Pagamento ainda não confirmado ou pendente.',
      })
    } catch (err) {
      console.log('[billing] Erro em sync-session: ' + err)
      return e.json(500, { error: 'Não foi possível sincronizar o pagamento. Tente novamente.' })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 4. POST /backend/v1/billing/cancel-subscription
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/billing/cancel-subscription',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      function inlineGetStripeConfig() {
        try {
          const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
          if (records.length > 0) {
            const r = records[0]
            return {
              id: r.id,
              secret_key: (r.getString('secret_key') || '').trim(),
            }
          }
        } catch (_) {}
        return null
      }

      function inlineStripeRequest(secretKey, method, path) {
        const url = 'https://api.stripe.com/v1' + path
        const authHeader = 'Bearer ' + secretKey
        const headers = {
          Authorization: authHeader,
        }
        const res = $http.send({
          url: url,
          method: method,
          headers: headers,
          timeout: 30,
        })
        // Corpo da resposta $http.send: res.json (parseado) ou res.raw (texto). res.rawText não existe.
        let parsed = null
        try {
          if (res.json && typeof res.json === 'object') {
            parsed = res.json
          } else {
            const rawStr = res.raw || ''
            if (rawStr) {
              try {
                parsed = JSON.parse(rawStr)
              } catch (_) {
                parsed = null
              }
            }
          }
        } catch (_) {
          parsed = null
        }
        return {
          statusCode: res.statusCode,
          data: parsed,
          rawText: res.raw || '',
        }
      }

      function inlineLogHistory(userId, eventType, data) {
        try {
          const col = $app.findCollectionByNameOrId('subscriptions_history')
          const rec = new Record(col)
          rec.set('user', userId)
          rec.set('event_type', eventType)
          if (data.status_from) rec.set('status_from', data.status_from)
          if (data.status_to) rec.set('status_to', data.status_to)
          if (data.details) rec.set('details', data.details)
          $app.save(rec)
        } catch (_) {}
      }

      const userRec = $app.findRecordById('_pb_users_auth_', authUser.id)
      const subId = userRec.getString('stripe_subscription_id')
      const oldStatus = userRec.getString('subscription_status')

      // Filosofia de cancelamento: a Stripe encerra a assinatura IMEDIATAMENTE
      // (nada de cobranças futuras), mas o cliente mantém acesso total até o
      // fim do período que já pagou. A data final (access_until) vem do
      // current_period_end da resposta do DELETE; se não vier, usa a vigência
      // já gravada no registro (subscription_expires_at).
      let accessUntil = ''
      const stripeCfg = inlineGetStripeConfig()
      if (subId && stripeCfg && stripeCfg.secret_key) {
        try {
          // Stripe cancelamento direto: DELETE /v1/subscriptions/{subId}
          const delRes = inlineStripeRequest(
            stripeCfg.secret_key,
            'DELETE',
            '/subscriptions/' + subId,
          )
          console.log('[billing] Cancelamento Stripe status: ' + delRes.statusCode)
          const delData = delRes.data
          if (delData) {
            const cpe =
              delData.current_period_end || (delData.items && delData.items.current_period_end) || 0
            if (cpe) {
              accessUntil = new Date(cpe * 1000).toISOString()
            }
            console.log(
              '[billing] current_period_end da Stripe: ' +
                (cpe || 'não retornado') +
                ' → access_until: ' +
                (accessUntil || '—'),
            )
          }
        } catch (cErr) {
          console.log('[billing] Erro ao cancelar na Stripe via API: ' + cErr)
        }
      }

      // Fallback: se a resposta do DELETE não trouxe a data, usa a vigência
      // já gravada no registro (fim do período pago calculado no checkout).
      if (!accessUntil) {
        const storedExpires = userRec.getString('subscription_expires_at') || ''
        if (storedExpires && new Date(storedExpires).getTime() > Date.now()) {
          accessUntil = storedExpires
        }
      }

      userRec.set('subscription_status', 'cancelado')
      userRec.set('access_until', accessUntil)
      $app.save(userRec)

      inlineLogHistory(userRec.id, 'subscription.cancelled', {
        status_from: oldStatus,
        status_to: 'cancelado',
        details: {
          cancelled_by: 'user_self_service',
          subscription_id: subId,
          access_until: accessUntil,
        },
      })

      const accessMsg = accessUntil
        ? ' Seu acesso ao app permanece garantido até ' +
          new Date(accessUntil).toLocaleDateString('pt-BR') +
          '.'
        : ' Seu período de acesso já pago já foi encerrado.'
      return e.json(200, {
        success: true,
        status: 'cancelado',
        access_until: accessUntil,
        message: 'Assinatura cancelada com sucesso.' + accessMsg,
      })
    } catch (err) {
      console.log('[billing] Erro em cancel-subscription: ' + err)
      return e.json(500, {
        error: 'Não foi possível cancelar a assinatura. Tente novamente ou fale com o suporte.',
      })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 5. POST /backend/v1/billing/create-portal-session
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/billing/create-portal-session',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      function inlineGetStripeConfig() {
        try {
          const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
          if (records.length > 0) {
            const r = records[0]
            return {
              id: r.id,
              secret_key: (r.getString('secret_key') || '').trim(),
            }
          }
        } catch (_) {}
        return null
      }

      function inlineStripeRequest(secretKey, method, path, formParams) {
        const url = 'https://api.stripe.com/v1' + path
        const authHeader = 'Bearer ' + secretKey
        const headers = {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
        let bodyStr = ''
        if (formParams && typeof formParams === 'object') {
          const pairs = []
          for (let k in formParams) {
            if (Object.prototype.hasOwnProperty.call(formParams, k)) {
              const v = formParams[k]
              if (v !== undefined && v !== null && v !== '') {
                pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
              }
            }
          }
          bodyStr = pairs.join('&')
        }

        const res = $http.send({
          url: url,
          method: method,
          headers: headers,
          body: bodyStr || undefined,
          timeout: 30,
        })
        // Corpo da resposta $http.send: res.json (parseado) ou res.raw (texto). res.rawText não existe.
        let parsed = null
        try {
          if (res.json && typeof res.json === 'object') {
            parsed = res.json
          } else {
            const rawStr = res.raw || ''
            if (rawStr) {
              try {
                parsed = JSON.parse(rawStr)
              } catch (_) {
                parsed = null
              }
            }
          }
        } catch (_) {
          parsed = null
        }
        return {
          statusCode: res.statusCode,
          data: parsed,
          rawText: res.raw || '',
        }
      }

      const userRec = $app.findRecordById('_pb_users_auth_', authUser.id)
      const customerId = userRec.getString('stripe_customer_id')
      if (!customerId) {
        return e.json(400, { error: 'Nenhum cadastro de cliente na Stripe vinculado.' })
      }

      const stripeCfg = inlineGetStripeConfig()
      if (!stripeCfg || !stripeCfg.secret_key) {
        return e.json(400, { error: 'Configuração Stripe ausente.' })
      }

      const bodyPortal = e.requestInfo().body || {}
      const appOrigin = 'https://agente-financeiro-whatsapp-37fd3.goskip.app'

      // Mesma allowlist do checkout: o cliente volta para o MESMO front de
      // onde saiu, preservando a sessão do PocketBase (sem cair no login).
      let requestHost = ''
      try {
        requestHost = String(e.request.header.get('Host') || '').toLowerCase()
      } catch (_) {}
      const isAllowedReturnUrl = function (url) {
        const s = String(url || '')
        if (s.indexOf('https://') !== 0 && s.indexOf('http://') !== 0) return false
        const host = s
          .slice(s.indexOf('://') + 3)
          .split('/')[0]
          .split(':')[0]
          .toLowerCase()
        if (!host) return false
        if (requestHost && host === requestHost) return true
        if (host.indexOf('localhost') === 0 || host.indexOf('127.0.0.1') === 0) return true
        if (host === 'agente-financeiro-whatsapp-37fd3.goskip.app') return true
        if (host.length > 11 && host.slice(-11) === '.goskip.app') return true
        return false
      }
      const rawReturnUrl = bodyPortal.return_url || ''
      if (rawReturnUrl && !isAllowedReturnUrl(rawReturnUrl)) {
        console.log(
          '[billing] return_url do portal fora da allowlist, usando fallback do front de produção: ' +
            rawReturnUrl,
        )
      }
      const returnUrl =
        rawReturnUrl && isAllowedReturnUrl(rawReturnUrl)
          ? rawReturnUrl
          : appOrigin + '/settings?section=assinatura&checkout=portal_return'

      const portalRes = inlineStripeRequest(
        stripeCfg.secret_key,
        'POST',
        '/billing_portal/sessions',
        {
          customer: customerId,
          return_url: returnUrl,
        },
      )

      if (
        portalRes.statusCode >= 200 &&
        portalRes.statusCode < 300 &&
        portalRes.data &&
        portalRes.data.url
      ) {
        return e.json(200, { url: portalRes.data.url })
      }

      console.log(
        '[billing] Falha ao criar portal session na Stripe (' +
          portalRes.statusCode +
          '): ' +
          portalRes.rawText,
      )
      return e.json(502, {
        error:
          'Não foi possível acessar o portal de faturamento. Tente novamente ou fale com o suporte.',
      })
    } catch (err) {
      console.log('[billing] Erro em create-portal-session: ' + err)
      return e.json(500, {
        error:
          'Não foi possível acessar o portal de faturamento. Tente novamente ou fale com o suporte.',
      })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 6. POST /backend/v1/billing/update-profile
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/billing/update-profile',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.json(401, { error: 'Não autenticado' })
      }

      function inlineValidateCPF(cpf) {
        const clean = String(cpf || '').replace(/\D/g, '')
        if (clean.length !== 11) return false
        if (/^(\d)\1{10}$/.test(clean)) return false
        let sum = 0
        for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i)
        let rev = 11 - (sum % 11)
        if (rev === 10 || rev === 11) rev = 0
        if (rev !== parseInt(clean.charAt(9), 10)) return false
        sum = 0
        for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i)
        rev = 11 - (sum % 11)
        if (rev === 10 || rev === 11) rev = 0
        return rev === parseInt(clean.charAt(10), 10)
      }

      function inlineValidateAge(birthDateStr) {
        if (!birthDateStr) return false
        const birth = new Date(birthDateStr)
        if (isNaN(birth.getTime())) return false
        const today = new Date()
        let age = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
        return age >= 18
      }

      const body = e.requestInfo().body || {}
      const userRec = $app.findRecordById('_pb_users_auth_', authUser.id)

      if (body.cpf !== undefined) {
        const cleanCpf = String(body.cpf).replace(/\D/g, '')
        if (cleanCpf && !inlineValidateCPF(cleanCpf)) {
          return e.json(400, { error: 'CPF inválido. Verifique os números informados.' })
        }
        if (cleanCpf) {
          try {
            const existing = $app.findRecordsByFilter(
              '_pb_users_auth_',
              "cpf = '" + cleanCpf + "' && id != '" + userRec.id + "'",
              '',
              1,
              0,
            )
            if (existing.length > 0) {
              return e.json(400, { error: 'Este CPF já está cadastrado em outra conta.' })
            }
          } catch (_) {}
          userRec.set('cpf', cleanCpf)
        }
      }

      if (body.birth_date !== undefined) {
        if (body.birth_date && !inlineValidateAge(body.birth_date)) {
          return e.json(400, {
            error: 'É necessário ter 18 anos ou mais para contratar o serviço.',
          })
        }
        userRec.set('birth_date', body.birth_date || '')
      }

      if (body.full_name !== undefined) userRec.set('full_name', body.full_name)
      if (body.zip_code !== undefined) userRec.set('zip_code', body.zip_code)
      if (body.street !== undefined) userRec.set('street', body.street)
      if (body.number !== undefined) userRec.set('number', body.number)
      if (body.complement !== undefined) userRec.set('complement', body.complement)
      if (body.neighborhood !== undefined) userRec.set('neighborhood', body.neighborhood)
      if (body.city !== undefined) userRec.set('city', body.city)
      if (body.state !== undefined) userRec.set('state', body.state)

      const nowIso = new Date().toISOString()
      if (body.accept_terms) {
        userRec.set('terms_accepted_at', nowIso)
      }
      if (body.accept_recurring) {
        userRec.set('recurring_consent_accepted_at', nowIso)
      }

      $app.save(userRec)

      return e.json(200, {
        success: true,
        message: 'Dados cadastrais atualizados com sucesso.',
      })
    } catch (err) {
      console.log('[billing] Erro em update-profile: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 7. POST /backend/v1/stripe/webhook
// ----------------------------------------------------
routerAdd('POST', '/backend/v1/stripe/webhook', (e) => {
  try {
    function inlineGetSigningSecret() {
      try {
        const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
        if (records.length > 0) {
          return (records[0].getString('webhook_signing_secret') || '').trim()
        }
      } catch (_) {}
      return ''
    }

    function inlineVerifyStripeSignature(payloadStr, sigHeader, signingSecret) {
      if (!sigHeader || !signingSecret) {
        // Se signing secret não estiver configurado, ignora checagem de assinatura
        return true
      }
      try {
        const parts = sigHeader.split(',')
        let timestamp = ''
        const signatures = []
        for (let i = 0; i < parts.length; i++) {
          const pair = parts[i].trim().split('=')
          if (pair.length === 2) {
            if (pair[0] === 't') timestamp = pair[1]
            if (pair[0] === 'v1') signatures.push(pair[1])
          }
        }
        if (!timestamp || signatures.length === 0) {
          console.log('[stripe_webhook] Cabeçalho Stripe-Signature malformatado: ' + sigHeader)
          return false
        }

        const signedPayload = timestamp + '.' + payloadStr
        const expectedSig = $security.hs256(signedPayload, signingSecret)

        let matched = false
        for (let j = 0; j < signatures.length; j++) {
          if (signatures[j] === expectedSig) {
            matched = true
            break
          }
        }

        if (!matched) {
          console.log('[stripe_webhook] Assinatura Stripe INVÁLIDA.')
          return false
        }
        return true
      } catch (verErr) {
        console.log('[stripe_webhook] Erro ao validar assinatura: ' + verErr)
        return false
      }
    }

    function inlineLogHistory(userId, eventType, data) {
      try {
        const col = $app.findCollectionByNameOrId('subscriptions_history')
        const rec = new Record(col)
        rec.set('user', userId)
        rec.set('event_type', eventType)
        if (data.plan_type) rec.set('plan_type', data.plan_type)
        if (data.amount_cents) rec.set('amount_cents', data.amount_cents)
        if (data.status_from) rec.set('status_from', data.status_from)
        if (data.status_to) rec.set('status_to', data.status_to)
        if (data.stripe_event_id) rec.set('stripe_event_id', data.stripe_event_id)
        if (data.details) rec.set('details', data.details)
        $app.save(rec)
      } catch (hErr) {
        console.log('[stripe_webhook] Falha ao registrar subscriptions_history: ' + hErr)
      }
    }

    const signingSecret = inlineGetSigningSecret()
    const reqHeaders = e.requestInfo().headers || {}
    const sigHeader =
      reqHeaders['stripe-signature'] ||
      reqHeaders['Stripe-Signature'] ||
      reqHeaders['STRIPE-SIGNATURE'] ||
      ''

    let rawPayloadStr = ''
    try {
      const bodyObj = e.requestInfo().body || {}
      rawPayloadStr = JSON.stringify(bodyObj)
    } catch (_) {}

    if (signingSecret && !inlineVerifyStripeSignature(rawPayloadStr, sigHeader, signingSecret)) {
      return e.json(400, { error: 'Assinatura inválida (Stripe-Signature verification failed)' })
    }

    const rawBody = e.requestInfo().body || {}
    const eventType = rawBody.type || ''
    const eventData = rawBody.data && rawBody.data.object ? rawBody.data.object : {}
    const eventId = rawBody.id || ''

    console.log('[stripe_webhook] Evento recebido: ' + eventType + ' (id: ' + eventId + ')')

    // 1. Checkout completed
    if (eventType === 'checkout.session.completed') {
      const sess = eventData
      const customerId = sess.customer || ''
      const subId = sess.subscription || ''
      const userId = sess.client_reference_id || (sess.metadata && sess.metadata.user_id) || ''
      const planType = (sess.metadata && sess.metadata.plan_type) || 'mensal'
      const priceCents = parseInt((sess.metadata && sess.metadata.price_cents) || '1990', 10)
      const isOneTime =
        (sess.metadata && sess.metadata.billing_mode) === 'one_time' || sess.mode === 'payment'

      let targetUser = null
      if (userId) {
        try {
          targetUser = $app.findRecordById('_pb_users_auth_', userId)
        } catch (_) {}
      }
      if (!targetUser && customerId) {
        try {
          targetUser = $app.findFirstRecordByData(
            '_pb_users_auth_',
            'stripe_customer_id',
            customerId,
          )
        } catch (_) {}
      }

      if (targetUser) {
        const oldSt = targetUser.getString('subscription_status')
        targetUser.set('subscription_status', 'active')
        targetUser.set('subscription_plan', planType)
        if (customerId) targetUser.set('stripe_customer_id', customerId)
        if (subId) targetUser.set('stripe_subscription_id', subId)
        targetUser.set('carencia_until', '')
        if (isOneTime) {
          // ANUAL VIA PIX (pagamento único): status ativa com validade de 12
          // meses (access_until). NÃO cria subscription Stripe nem grava
          // stripe_subscription_id — quando access_until expirar, a conta
          // volta a não-assinante.
          const accessDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          targetUser.set('access_until', accessDate)
          targetUser.set('subscription_expires_at', accessDate)
        } else {
          // Reativação via webhook: período pós-cancelamento deixa de existir.
          targetUser.set('access_until', '')
          const addDays = planType === 'anual' ? 365 : 30
          const expiresAt = new Date(Date.now() + addDays * 24 * 60 * 60 * 1000).toISOString()
          targetUser.set('subscription_expires_at', expiresAt)
        }
        $app.save(targetUser)

        inlineLogHistory(targetUser.id, 'stripe.checkout.session.completed', {
          plan_type: planType,
          amount_cents: priceCents,
          status_from: oldSt,
          status_to: 'active',
          stripe_event_id: eventId,
          details: {
            session_id: sess.id,
            mode: sess.mode,
            billing_mode: isOneTime ? 'one_time' : 'recurring',
            payment_method: (sess.payment_method_types || []).join(','),
          },
        })
        console.log(
          '[stripe_webhook] Usuário ' +
            targetUser.id +
            ' ATIVADO (mode=' +
            sess.mode +
            ', access_until=' +
            (targetUser.getString('access_until') || '—') +
            ').',
        )
      }
    }

    // 2. Fatura paga
    if (eventType === 'invoice.payment_succeeded') {
      const inv = eventData
      const customerId = inv.customer || ''
      const subId = inv.subscription || ''
      const amountPaid = inv.amount_paid || 0

      if (customerId) {
        try {
          const targetUser = $app.findFirstRecordByData(
            '_pb_users_auth_',
            'stripe_customer_id',
            customerId,
          )
          if (targetUser) {
            const oldSt = targetUser.getString('subscription_status')
            targetUser.set('subscription_status', 'active')
            targetUser.set('carencia_until', '')
            const plan = targetUser.getString('subscription_plan') || 'mensal'
            const addDays = plan === 'anual' ? 365 : 30
            targetUser.set(
              'subscription_expires_at',
              new Date(Date.now() + addDays * 24 * 60 * 60 * 1000).toISOString(),
            )
            $app.save(targetUser)

            inlineLogHistory(targetUser.id, 'stripe.invoice.payment_succeeded', {
              plan_type: plan,
              amount_cents: amountPaid,
              status_from: oldSt,
              status_to: 'active',
              stripe_event_id: eventId,
              details: { invoice_id: inv.id, subscription_id: subId },
            })
          }
        } catch (uErr) {
          console.log('[stripe_webhook] Erro invoice.payment_succeeded: ' + uErr)
        }
      }
    }

    // 3. Fatura falhou: CARÊNCIA DE 7 DIAS
    if (eventType === 'invoice.payment_failed') {
      const inv = eventData
      const customerId = inv.customer || ''

      if (customerId) {
        try {
          const targetUser = $app.findFirstRecordByData(
            '_pb_users_auth_',
            'stripe_customer_id',
            customerId,
          )
          if (targetUser) {
            const oldSt = targetUser.getString('subscription_status')
            const carenciaDays = 7
            const carenciaDate = new Date(
              Date.now() + carenciaDays * 24 * 60 * 60 * 1000,
            ).toISOString()

            targetUser.set('subscription_status', 'carencia')
            targetUser.set('carencia_until', carenciaDate)
            $app.save(targetUser)

            inlineLogHistory(targetUser.id, 'stripe.invoice.payment_failed', {
              status_from: oldSt,
              status_to: 'carencia',
              stripe_event_id: eventId,
              details: {
                invoice_id: inv.id,
                carencia_until: carenciaDate,
                failure_message: inv.last_payment_error || 'Payment failed',
              },
            })
            console.log(
              '[stripe_webhook] Pagamento falhou. Usuário ' +
                targetUser.id +
                ' em CARÊNCIA até ' +
                carenciaDate,
            )
          }
        } catch (uErr) {
          console.log('[stripe_webhook] Erro invoice.payment_failed: ' + uErr)
        }
      }
    }

    // 4. Subscription deleted
    if (eventType === 'customer.subscription.deleted') {
      const sub = eventData
      const customerId = sub.customer || ''
      if (customerId) {
        try {
          const targetUser = $app.findFirstRecordByData(
            '_pb_users_auth_',
            'stripe_customer_id',
            customerId,
          )
          if (targetUser) {
            const oldSt = targetUser.getString('subscription_status')
            targetUser.set('subscription_status', 'cancelado')
            // Filosofia de cancelamento: NUNCA apagar um access_until no
            // futuro — o cliente cancelou e segue com acesso garantido até o
            // fim do período já pago, mesmo que este webhook chegue depois.
            const keepAccess = targetUser.getString('access_until') || ''
            if (!keepAccess) {
              // Cancelamento vindo só do portal sem passar pelo nosso botão:
              // garante a data de acesso a partir da vigência gravada.
              const storedExpires = targetUser.getString('subscription_expires_at') || ''
              if (storedExpires && new Date(storedExpires).getTime() > Date.now()) {
                targetUser.set('access_until', storedExpires)
              }
            }
            $app.save(targetUser)

            inlineLogHistory(targetUser.id, 'stripe.subscription.deleted', {
              status_from: oldSt,
              status_to: 'cancelado',
              stripe_event_id: eventId,
              details: { subscription_id: sub.id },
            })
          }
        } catch (uErr) {
          console.log('[stripe_webhook] Erro subscription.deleted: ' + uErr)
        }
      }
    }

    return e.json(200, { received: true, event: eventType })
  } catch (err) {
    console.log('[stripe_webhook] Erro geral: ' + err)
    return e.json(200, { received: false, error: String(err) })
  }
})

// ----------------------------------------------------
// 8. GET /backend/v1/admin/billing/stripe-config
// Leitura mascarada das credenciais Stripe (somente admin)
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/billing/stripe-config',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      function inlineMaskKey(key) {
        if (!key) return ''
        const trimmed = String(key).trim()
        if (trimmed.length <= 10) return '***'
        const prefix = trimmed.slice(0, 8)
        const suffix = trimmed.slice(-4)
        return prefix + '***' + suffix
      }

      const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
      if (records.length === 0) {
        return e.json(200, {
          configured: false,
          has_secret_key: false,
          has_webhook_signing_secret: false,
          masked_secret_key: '',
          masked_webhook_signing_secret: '',
          price_id_mensal: '',
          price_id_anual: '',
          updated: '',
          updated_by: '',
        })
      }

      const r = records[0]
      const rawSecret = r.getString('secret_key') || ''
      const rawWhsec = r.getString('webhook_signing_secret') || ''

      return e.json(200, {
        configured: !!rawSecret.trim(),
        has_secret_key: !!rawSecret.trim(),
        has_webhook_signing_secret: !!rawWhsec.trim(),
        masked_secret_key: inlineMaskKey(rawSecret),
        masked_webhook_signing_secret: inlineMaskKey(rawWhsec),
        price_id_mensal: r.getString('price_id_mensal') || '',
        price_id_anual: r.getString('price_id_anual') || '',
        updated: r.getString('updated') || '',
        updated_by: r.getString('updated_by') || '',
      })
    } catch (err) {
      console.log('[admin_stripe_config] Erro GET: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 9. POST /backend/v1/admin/billing/stripe-config
// Gravação das credenciais Stripe (somente admin)
// Preserva chave existente se não fornecida nova.
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/billing/stripe-config',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const body = e.requestInfo().body || {}
      const col = $app.findCollectionByNameOrId('stripe_config')
      const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
      let rec = records.length > 0 ? records[0] : new Record(col)

      // Atualiza secret_key somente se enviado um valor não-mascarado
      if (body.secret_key !== undefined) {
        const rawKey = String(body.secret_key).trim()
        if (rawKey && rawKey.indexOf('***') === -1) {
          rec.set('secret_key', rawKey)
        }
      }

      // Atualiza webhook_signing_secret se enviado valor não-mascarado
      if (body.webhook_signing_secret !== undefined) {
        const rawWhsec = String(body.webhook_signing_secret).trim()
        if (rawWhsec.indexOf('***') === -1) {
          rec.set('webhook_signing_secret', rawWhsec)
        }
      }

      if (body.price_id_mensal !== undefined) {
        rec.set('price_id_mensal', String(body.price_id_mensal).trim())
      }
      if (body.price_id_anual !== undefined) {
        rec.set('price_id_anual', String(body.price_id_anual).trim())
      }

      rec.set('updated_by', email || authUser.id)
      $app.save(rec)

      // Se informou os price IDs, sincroniza também nos subscription_plans correspondentes
      if (body.price_id_mensal) {
        try {
          const plansM = $app.findRecordsByFilter(
            'subscription_plans',
            "user_override = null && plan_type = 'mensal'",
            '-created',
            5,
            0,
          )
          for (let m = 0; m < plansM.length; m++) {
            plansM[m].set('stripe_price_id', String(body.price_id_mensal).trim())
            $app.save(plansM[m])
          }
        } catch (_) {}
      }
      if (body.price_id_anual) {
        try {
          const plansA = $app.findRecordsByFilter(
            'subscription_plans',
            "user_override = null && plan_type = 'anual'",
            '-created',
            5,
            0,
          )
          for (let a = 0; a < plansA.length; a++) {
            plansA[a].set('stripe_price_id', String(body.price_id_anual).trim())
            $app.save(plansA[a])
          }
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        message: 'Configuração da Stripe salva com sucesso!',
      })
    } catch (err) {
      console.log('[admin_stripe_config] Erro POST: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 10. GET /backend/v1/admin/billing/plans
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/billing/plans',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      function inlineGetLegal() {
        try {
          const records = $app.findRecordsByFilter('company_legal_info', '', '-created', 1, 0)
          if (records.length > 0) {
            const r = records[0]
            return {
              id: r.id,
              company_name: r.getString('company_name'),
              trade_name: r.getString('trade_name'),
              cnpj: r.getString('cnpj'),
              address_full: r.getString('address_full'),
              email_contact: r.getString('email_contact'),
              support_phone_or_bot: r.getString('support_phone_or_bot'),
              terms_version: r.getString('terms_version') || 'v1.0',
              privacy_version: r.getString('privacy_version') || 'v1.0',
              trial_days_default: r.getInt('trial_days_default') || 7,
              carencia_days_default: r.getInt('carencia_days_default') || 7,
            }
          }
        } catch (_) {}
        return null
      }

      const allPlans = $app.findRecordsByFilter('subscription_plans', '', '-created', 100, 0)
      const usersCol = $app.findRecordsByFilter('_pb_users_auth_', '', '-created', 500, 0)
      const userMap = {}
      for (let i = 0; i < usersCol.length; i++) {
        userMap[usersCol[i].id] = {
          name: usersCol[i].getString('name') || usersCol[i].getString('full_name') || 'Sem nome',
          email: usersCol[i].getString('email'),
        }
      }

      const formatted = allPlans.map((p) => {
        const uId = p.getString('user_override')
        return {
          id: p.id,
          plan_type: p.getString('plan_type'),
          name: p.getString('name'),
          price_cents: p.getInt('price_cents'),
          stripe_price_id: p.getString('stripe_price_id'),
          stripe_product_id: p.getString('stripe_product_id'),
          valid_from: p.getString('valid_from'),
          valid_until: p.getString('valid_until'),
          active: p.getBool('active'),
          notes: p.getString('notes'),
          user_override: uId,
          user_override_info: uId ? userMap[uId] || null : null,
          created: p.getString('created'),
          updated: p.getString('updated'),
        }
      })

      return e.json(200, {
        plans: formatted,
        legal_info: inlineGetLegal(),
      })
    } catch (err) {
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 11. POST /backend/v1/admin/billing/plans
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/billing/plans',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const body = e.requestInfo().body || {}
      const planId = body.id
      const plansCol = $app.findCollectionByNameOrId('subscription_plans')

      let rec = null
      if (planId) {
        rec = $app.findRecordById('subscription_plans', planId)
      } else {
        rec = new Record(plansCol)
      }

      if (body.plan_type) rec.set('plan_type', body.plan_type)
      if (body.name) rec.set('name', body.name)
      if (body.price_cents !== undefined) rec.set('price_cents', parseInt(body.price_cents, 10))
      if (body.valid_from) rec.set('valid_from', body.valid_from)
      rec.set('valid_until', body.valid_until || '')
      rec.set('stripe_price_id', body.stripe_price_id || '')
      rec.set('stripe_product_id', body.stripe_product_id || '')
      rec.set('user_override', body.user_override || '')
      rec.set('active', body.active !== undefined ? !!body.active : true)
      rec.set('notes', body.notes || '')

      $app.save(rec)

      return e.json(200, {
        success: true,
        message: 'Plano salvo com sucesso!',
        id: rec.id,
      })
    } catch (err) {
      console.log('[admin_billing] Erro ao salvar plano: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 12. POST /backend/v1/admin/billing/legal-info
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/billing/legal-info',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const body = e.requestInfo().body || {}
      const records = $app.findRecordsByFilter('company_legal_info', '', '-created', 1, 0)
      const col = $app.findCollectionByNameOrId('company_legal_info')

      let rec = records.length > 0 ? records[0] : new Record(col)

      if (body.company_name) rec.set('company_name', body.company_name)
      if (body.trade_name) rec.set('trade_name', body.trade_name)
      if (body.cnpj) rec.set('cnpj', body.cnpj)
      if (body.address_full) rec.set('address_full', body.address_full)
      if (body.email_contact) rec.set('email_contact', body.email_contact)
      if (body.support_phone_or_bot !== undefined)
        rec.set('support_phone_or_bot', body.support_phone_or_bot)
      if (body.terms_version) rec.set('terms_version', body.terms_version)
      if (body.privacy_version) rec.set('privacy_version', body.privacy_version)
      if (body.trial_days_default !== undefined)
        rec.set('trial_days_default', parseInt(body.trial_days_default, 10))
      if (body.carencia_days_default !== undefined)
        rec.set('carencia_days_default', parseInt(body.carencia_days_default, 10))

      $app.save(rec)

      return e.json(200, {
        success: true,
        message: 'Dados legais atualizados com sucesso!',
      })
    } catch (err) {
      console.log('[admin_billing] Erro ao salvar dados legais: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 13. GET /backend/v1/admin/billing/subscriptions
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/billing/subscriptions',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const allUsers = $app.findRecordsByFilter(
        '_pb_users_auth_',
        "email != 'whatsapp-visitante@agente.internal'",
        '-created',
        500,
        0,
      )

      let totalActive = 0
      let totalTrial = 0
      let totalCarencia = 0
      let totalBloqueado = 0
      let totalCancelado = 0

      const clientsList = allUsers.map((u) => {
        const status = u.getString('subscription_status') || 'trial'
        if (status === 'active') totalActive++
        else if (status === 'trial') totalTrial++
        else if (status === 'carencia') totalCarencia++
        else if (status === 'bloqueado') totalBloqueado++
        else if (status === 'cancelado') totalCancelado++

        return {
          id: u.id,
          name: u.getString('name') || u.getString('full_name') || 'Sem nome',
          full_name: u.getString('full_name') || '',
          email: u.getString('email'),
          phone: u.getString('phone') || '',
          cpf: u.getString('cpf') || '',
          subscription_status: status,
          subscription_plan: u.getString('subscription_plan') || 'mensal',
          subscription_expires_at: u.getString('subscription_expires_at') || '',
          carencia_until: u.getString('carencia_until') || '',
          stripe_customer_id: u.getString('stripe_customer_id') || '',
          stripe_subscription_id: u.getString('stripe_subscription_id') || '',
          terms_accepted_at: u.getString('terms_accepted_at') || '',
          recurring_consent_accepted_at: u.getString('recurring_consent_accepted_at') || '',
          created: u.getString('created'),
        }
      })

      return e.json(200, {
        metrics: {
          total: allUsers.length,
          active: totalActive,
          trial: totalTrial,
          carencia: totalCarencia,
          bloqueado: totalBloqueado,
          cancelado: totalCancelado,
        },
        clients: clientsList,
      })
    } catch (err) {
      console.log('[admin_billing] Erro em /subscriptions: ' + err)
      return e.json(500, { error: String(err) })
    }
  },
  $apis.requireAuth(),
)
