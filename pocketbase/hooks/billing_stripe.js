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

      // ANUAL VIA PIX (pagamento único): dados para a tela Minha Conta exibir
      // valor pago e data do pagamento (o front monta o resumo do one-time).
      // Padrão JSVM: variáveis declaradas ANTES do try (escopo de bloco).
      let lastPaymentAmount = 0
      let lastPaymentAt = ''
      try {
        const hists = $app.findRecordsByFilter(
          'subscriptions_history',
          "user = '" +
            userRec.id +
            "' && (event_type = 'stripe.checkout.session.completed' || event_type = 'checkout.completed')",
          '-created',
          1,
          0,
        )
        if (hists.length > 0) {
          lastPaymentAmount = hists[0].getInt('amount_cents')
          lastPaymentAt = hists[0].getString('created')
        }
      } catch (pErr) {
        console.log('[billing] Erro ao buscar último pagamento: ' + pErr)
      }
      const isOneTimeActive = effectiveStatus === 'active' && !subId && accessUntilValid

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
        billing_mode: isOneTimeActive ? 'one_time' : 'recurring',
        payment_amount_cents: lastPaymentAmount,
        payment_paid_at: lastPaymentAt,
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
              price_id_anual_recorrente: (r.getString('price_id_anual_recorrente') || '').trim(),
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

        // Se o plano ainda não tem stripe_price_id mas stripe_config tem o price_id correspondente, usa-o.
        // v0.0.98: o anual RECORRENTE usa EXCLUSIVAMENTE o price_id_anual_recorrente
        // (Price novo "Por ano", R$ 214,90). O antigo price_id_anual era um Price
        // recorrente MENSAL bugado (causa do bug da v0.0.95) e NUNCA é usado.
        if (!resolved.stripe_price_id && config) {
          if (planType === 'mensal' && config.price_id_mensal) {
            resolved.stripe_price_id = config.price_id_mensal
          } else if (planType === 'anual' && config.price_id_anual_recorrente) {
            resolved.stripe_price_id = config.price_id_anual_recorrente
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
      // v0.0.98 — DOIS CAMINHOS COEXISTEM no plano anual:
      // - billing_mode=one_time → Pix à vista (mode=payment, access_until +12m);
      // - billing_mode=recurring (default) → assinatura recorrente anual
      //   (mode=subscription) usando o NOVO price_id_anual_recorrente da Stripe.
      // A assinatura MENSAL permanece mode=subscription (cartão recorrente).
      const billingMode = body.billing_mode === 'one_time' ? 'one_time' : 'recurring'
      if (billingMode === 'one_time' && planType !== 'anual') {
        return e.json(400, { error: 'Pagamento único está disponível apenas no plano anual.' })
      }
      // Anual recorrente exige o Price anual ("Por ano") parametrizado no
      // Backoffice. Sem ele, o checkout recorrente anual é recusado com erro
      // amigável (o cliente pode optar pelo Pix à vista, que não depende dele).
      if (
        billingMode === 'recurring' &&
        planType === 'anual' &&
        !stripeCfg.price_id_anual_recorrente
      ) {
        return e.json(400, {
          error:
            'A assinatura anual recorrente ainda não está configurada. Use o pagamento único via Pix ou fale com o suporte.',
          code: 'ANUAL_RECORRENTE_NAO_CONFIGURADO',
        })
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

      // Pix (pagamento único): NÃO enviamos payment_method_types — a Stripe
      // RECUSA esse parâmetro na criação de Checkout Session com 400 ("The
      // `payment_method_types` parameter is no longer supported… Payment
      // methods are now managed from your Dashboard Payment Method settings"),
      // que chegava ao front como 502 em ~80ms (v0.0.93). Com os métodos
      // automáticos do Dashboard, o checkout exibe sozinho os métodos
      // habilitados na conta (cartão + Pix para contas domiciliadas no
      // Brasil). O webhook de checkout.session.completed decide o que fazer
      // pelo metadata.billing_mode (one_time → +12 meses, sem subscription).
      // (Bloco vazio mantido como marcador documentado da decisão.)

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
          '[billing] Falha Stripe Checkout (mode=' +
            billingMode +
            ', plan=' +
            planType +
            ', status=' +
            sessRes.statusCode +
            '): ' +
            sessRes.rawText,
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
        // v0.0.95: se sobrou um subId de assinatura recorrente antiga, LIMPA —
        // mesmo comportamento defensivo do webhook checkout.session.completed.
        if (isOneTime) {
          userRec.set('stripe_subscription_id', '')
        } else if (subId) {
          userRec.set('stripe_subscription_id', subId)
        }
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

      // PLANO ANUAL VIA PIX (pagamento único, v0.0.95): não existe assinatura
      // para cancelar — o acesso já está todo pago até access_until. Recusar
      // com mensagem clara em vez de prosseguir sem o que cancelar.
      // v0.0.98: o anual RECORRENTE (com stripe_subscription_id) cancela
      // normalmente aqui embaixo — o bloqueio vale apenas para o one_time.
      const oneTimeAccess = userRec.getString('access_until') || ''
      const oneTimeValid = oneTimeAccess !== '' && new Date(oneTimeAccess).getTime() > Date.now()
      if (
        oldStatus === 'active' &&
        !subId &&
        oneTimeValid &&
        userRec.getString('subscription_plan') === 'anual'
      ) {
        return e.json(400, {
          error:
            'Seu plano anual foi pago à vista (pagamento único) e não possui assinatura a cancelar. O acesso vale até ' +
            new Date(oneTimeAccess).toLocaleDateString('pt-BR') +
            '.',
        })
      }

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

      // PLANO ANUAL VIA PIX (pagamento único, v0.0.95): o portal da Stripe só
      // gerencia ASSINATURAS — para quem pagou o anual à vista ele mostraria
      // apenas faturas antigas (ex.: mensal anterior) e nenhuma ação útil,
      // gerando confusão ("Gerenciar assinatura" que não gerencia nada).
      // O front já oculta o botão para esse perfil (isOneTimePlan); o gate
      // aqui é a última linha de defesa, com mensagem explicativa.
      const portalAccess = userRec.getString('access_until') || ''
      const portalOneTimeValid =
        portalAccess !== '' && new Date(portalAccess).getTime() > Date.now()
      if (
        userRec.getString('subscription_status') === 'active' &&
        !userRec.getString('stripe_subscription_id') &&
        portalOneTimeValid &&
        userRec.getString('subscription_plan') === 'anual'
      ) {
        return e.json(400, {
          error:
            'Seu plano anual foi pago à vista (pagamento único): não existe assinatura para gerenciar no portal. O acesso vale até ' +
            new Date(portalAccess).toLocaleDateString('pt-BR') +
            '.',
        })
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
      const amountTotal = parseInt(String(sess.amount_total || '0'), 10) || 0

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
        // v0.0.98 — DOIS CAMINHOS COEXISTEM no anual:
        // - one_time (Pix à vista, mode=payment): um 'active' one-time NUNCA
        //   pode carregar um stripe_subscription_id — se sobrou um subId de uma
        //   assinatura recorrente antiga (ex.: mensal cancelada antes de migrar
        //   para o Pix), ele é LIMPO aqui. Caso contrário, /billing/status
        //   reporta has_stripe_subscription=true, e a tela Minha Conta volta a
        //   mostrar "Gerenciar assinatura" (portal com a fatura antiga) para um
        //   cliente que pagou o anual à vista e não tem o que gerenciar.
        // - recurring (assinatura Stripe, subscription): grava o
        //   stripe_subscription_id normalmente — a renovação a cada 12 meses é
        //   via invoice.payment_succeeded (v0.0.98, price_id_anual_recorrente).
        if (isOneTime) {
          targetUser.set('stripe_subscription_id', '')
        } else if (subId) {
          targetUser.set('stripe_subscription_id', subId)
        }
        targetUser.set('carencia_until', '')
        if (isOneTime) {
          // ANUAL VIA PIX (pagamento único): status ativa com validade de 12
          // meses (access_until). NÃO cria subscription Stripe nem grava
          // stripe_subscription_id — quando access_until expirar, a conta
          // volta a não-assinante. (Nunca recebe o aviso de renovação
          // pré-cobrança 3d/1d — esse é só para recorrentes.)
          const accessDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          targetUser.set('access_until', accessDate)
          targetUser.set('subscription_expires_at', accessDate)
        } else {
          // Assinatura recorrente (mensal OU anual, v0.0.98): reativação via
          // webhook — período pós-cancelamento deixa de existir. A renovação
          // anual é a cada 12 meses (365 dias) pelo ciclo da Stripe.
          targetUser.set('access_until', '')
          const addDays = planType === 'anual' ? 365 : 30
          const expiresAt = new Date(Date.now() + addDays * 24 * 60 * 60 * 1000).toISOString()
          targetUser.set('subscription_expires_at', expiresAt)
        }
        $app.save(targetUser)

        inlineLogHistory(targetUser.id, 'stripe.checkout.session.completed', {
          plan_type: planType,
          amount_cents: amountTotal || priceCents,
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
          price_id_anual_recorrente: '',
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
        price_id_anual_recorrente: r.getString('price_id_anual_recorrente') || '',
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
      // v0.0.98: Price anual recorrente novo ("Por ano"). Salvar vazio é permitido
      // (limpa o campo), com o checkout anual recorrente recusando sem ele.
      if (body.price_id_anual_recorrente !== undefined) {
        rec.set('price_id_anual_recorrente', String(body.price_id_anual_recorrente).trim())
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
      // v0.0.98: price_id_anual_recorrente NÃO é propagado para
      // subscription_plans.stripe_price_id (evita que o mensal bugado volte pelo
      // plano); a resolução do checkout recorrente lê direto de stripe_config.

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
// 9.b (v0.0.114) Diagnóstico da cobertura contínua por trilha — GET
// /backend/v1/admin/billing/plans/coverage. Somente admins. Não grava nada:
// devolve como a linha de vigências ativas de CADA trilha (mensal e anual)
// está simulada a partir de hoje e se há alguma lacuna (a mesma função
// globalThis.__vigenciaCobertura usada na validação de salvamento).
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/billing/plans/coverage',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const localAll = $app.findRecordsByFilter(
        'subscription_plans',
        "active = true && (user_override = '' || user_override = null)",
        'valid_from',
        200,
        0,
      )
      const localTrilhas = { mensal: [], anual: [] }
      for (var localGi = 0; localGi < localAll.length; localGi++) {
        var localRow = localAll[localGi]
        var localT = String(localRow.getString('plan_type') || '')
        if (localT !== 'mensal' && localT !== 'anual') continue
        localTrilhas[localT].push({
          id: localRow.id,
          name: String(localRow.getString('name') || 'sem nome'),
          from: String(localRow.getString('valid_from') || '').slice(0, 10),
          until: String(localRow.getString('valid_until') || '').slice(0, 10),
        })
      }
      const localResult = []
      const localTipos = ['mensal', 'anual']
      for (var localTi = 0; localTi < localTipos.length; localTi++) {
        var localTipo = localTipos[localTi]
        var localErr = ''
        var localCoberturaResolvida = false
        try {
          if (
            typeof globalThis !== 'undefined' &&
            typeof globalThis.__vigenciaCobertura === 'function'
          ) {
            localErr = String(
              globalThis.__vigenciaCobertura(localTipo, localTrilhas[localTipo]) || '',
            )
            localCoberturaResolvida = true
          }
        } catch (localCoberturaCallErr) {
          console.log(
            '[admin_billing] /plans/coverage: __vigenciaCobertura falhou (' +
              localCoberturaCallErr +
              ') — usando fallback inline v0.0.115.',
          )
        }
        if (!localCoberturaResolvida) {
          // v0.0.115 — FALLBACK 100% INLINE (mesma lógica da referência
          // _vigencia_cobertura_reference.js): a JSVM não compartilha o
          // globalThis de forma confiável entre módulos/hooks em todos os
          // pools de VM — nunca depende de ordem de carregamento.
          var today = new Date().toISOString().slice(0, 10)
          var intervals = []
          for (var fbI = 0; fbI < localTrilhas[localTipo].length; fbI++) {
            var fbRow = localTrilhas[localTipo][fbI]
            if (!fbRow.from) continue
            if (fbRow.until && fbRow.until < today) continue
            intervals.push({
              from: fbRow.from > today ? fbRow.from : today,
              until: fbRow.until || '',
            })
          }
          if (intervals.length === 0) {
            localErr =
              'A trilha ' +
              localTipo +
              ' ficaria SEM nenhum plano ativo a partir de hoje (' +
              today +
              ') — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível.'
          } else {
            intervals.sort(function (a, b) {
              if (a.from < b.from) return -1
              if (a.from > b.from) return 1
              return 0
            })
            var cursor = ''
            for (var fbJ = 0; fbJ < intervals.length; fbJ++) {
              var fbIv = intervals[fbJ]
              if (cursor === '') {
                if (fbIv.from > today) {
                  localErr =
                    'A trilha ' +
                    localTipo +
                    ' ficaria SEM nenhum plano ativo de hoje (' +
                    today +
                    ') até ' +
                    fbIv.from +
                    ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível. Inicie a nova vigência em ' +
                    today +
                    ' ou antes.'
                  break
                }
              } else if (fbIv.from > cursor) {
                localErr =
                  'A trilha ' +
                  localTipo +
                  ' ficaria SEM cobertura entre ' +
                  cursor +
                  ' e ' +
                  fbIv.from +
                  ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar nesse período (ex.: 03/12/2026) não encontraria plano disponível. Ajuste as vigências para que a trilha seja contínua (ex.: uma termina 30/11 e a próxima começa 01/12).'
                break
              }
              if (fbIv.until === '') {
                cursor = ''
              } else if (cursor === '' || fbIv.until > cursor) {
                cursor = fbIv.until
              }
            }
            if (localErr === '' && cursor !== '') {
              localErr =
                'A trilha ' +
                localTipo +
                ' terminaria em ' +
                cursor +
                ' e ficaria SEM cobertura a partir do dia seguinte — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante), para que todo o futuro continue coberto.'
            }
          }
        }
        localResult.push({
          plan_type: localTipo,
          rows: localTrilhas[localTipo],
          ok: localErr === '',
          error: localErr,
        })
      }
      return e.json(200, { today: new Date().toISOString().slice(0, 10), trilhas: localResult })
    } catch (err) {
      console.log('[admin_billing] Erro em /plans/coverage: ' + err)
      return e.json(500, { error: 'Falha ao simular a cobertura de vigências.' })
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

      // v0.0.111: trilha de auditoria — resolve os nomes dos planos citados
      // na coleção subscription_plans_audit para a UI de Histórico.
      var localAuditPlanNames = {}
      try {
        var localAuditRows = $app.findRecordsByFilter(
          'subscription_plans_audit',
          '',
          '-created',
          500,
          0,
        )
        for (var localAi = 0; localAi < localAuditRows.length; localAi++) {
          localAuditPlanNames[localAuditRows[localAi].getString('plan') || ''] =
            localAuditRows[localAi].getString('plan_name') || ''
        }
      } catch (_) {}
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
      // v0.0.111: snapshot dos valores ANTES da gravação, para a trilha de
      // auditoria (subscription_plans_audit) — antes → depois por campo.
      var localPrevCents = 0
      var localPrevActive = false
      var localPrevFrom = ''
      var localPrevUntil = ''
      var localPrevMap = {}
      if (planId) {
        rec = $app.findRecordById('subscription_plans', planId)
        localPrevCents = rec.getInt('price_cents')
        localPrevActive = rec.getBool('active')
        localPrevFrom = String(rec.getString('valid_from') || '').slice(0, 10)
        localPrevUntil = String(rec.getString('valid_until') || '').slice(0, 10)
        localPrevMap = {
          valid_from: localPrevFrom,
          valid_until: localPrevUntil,
          stripe_price_id: String(rec.getString('stripe_price_id') || ''),
        }
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

      // v0.0.106: validação de integridade de vigência executada AQUI, inline na
      // rota (fonte única, independente de hook de coleção). Regra (definição
      // expressa da usuária): dentro do MESMO plan_type, janelas INCLUSIVAS nas
      // duas pontas [from, until] não podem se sobrepor — nem o início nem o
      // fim podem coincidir (fim dia X + início dia X = dois planos vigentes no
      // mesmo dia = conflito). Janelas consecutivas devem deixar no mínimo um
      // dia de diferença na fronteira (ex.: termina 30/11, começa 01/12).
      // valid_until vazio = "em diante"; linhas inativas e com user_override
      // ficam fora da checagem; a própria linha (edição) é desconsiderada pelo id.
      var localPlanId = String(body.id || '')
      var localPlanType = String(body.plan_type || rec.getString('plan_type') || '')
      var localVFrom = String(body.valid_from || '').slice(0, 10)
      var localVUntil = String(body.valid_until || '').slice(0, 10)
      var localIsOverride = String(body.user_override || '') !== ''
      var localIsActive = body.active !== undefined ? !!body.active : true
      if (localPlanType && localIsActive && !localIsOverride) {
        if (localVFrom && localVUntil && localVUntil <= localVFrom) {
          return e.json(400, {
            error:
              'Vigência inválida: a data final (' +
              localVUntil +
              ') deve ser posterior à data inicial (' +
              localVFrom +
              ').',
          })
        }
        var localConflicts = $app.findRecordsByFilter(
          'subscription_plans',
          "plan_type = '" +
            localPlanType +
            "' && active = true && (user_override = '' || user_override = null)",
          '-created',
          100,
          0,
        )
        var localConflict = null
        for (var localCi = 0; localCi < localConflicts.length; localCi++) {
          var localRow = localConflicts[localCi]
          if (localPlanId && localRow.id === localPlanId) continue
          var localRowFrom = String(localRow.getString('valid_from') || '').slice(0, 10)
          var localRowUntil = String(localRow.getString('valid_until') || '').slice(0, 10)
          // Fronteira INCLUSIVA nas duas pontas (v0.0.106): sobreposição exige
          // newFrom <= rowUntil E rowFrom <= newUntil — terminar/começar no
          // MESMO dia é conflito (dois planos vigentes no mesmo dia).
          var localNewStartsInRow = !localRowUntil || localVFrom <= localRowUntil
          var localRowStartsInNew = !localVUntil || localRowFrom <= localVUntil
          if (localNewStartsInRow && localRowStartsInNew) {
            localConflict = localRow
            break
          }
        }
        if (localConflict) {
          var localRowName = localConflict.getString('name') || 'sem nome'
          var localRowFrom = String(localConflict.getString('valid_from') || '').slice(0, 10)
          var localRowUntil = String(localConflict.getString('valid_until') || '').slice(0, 10)
          var localPeriodo =
            (localRowFrom || 'início aberto') +
            ' até ' +
            (localRowUntil || 'em diante (sem data final)')
          return e.json(400, {
            error:
              'Já existe um plano ' +
              localPlanType +
              ' vigente no período ' +
              localPeriodo +
              ': ' +
              localRowName +
              '. As janelas não podem se tocar (nem o início nem o fim podem coincidir) — deixe no mínimo um dia de diferença na fronteira (ex.: termina 30/11, começa 01/12).',
          })
        }

        // v0.0.114 — COBERTURA CONTÍNUA POR TRILHA (pedido expresso da dona):
        // da data corrente em diante, nenhum dia futuro pode ficar sem plano
        // ativo definido na trilha (senão um cliente que chega para se cadastrar
        // não encontra plano disponível). Simula a linha de vigências ativas da
        // trilha (mensal e anual separadamente) incluindo a linha que está sendo
        // salva e rejeita qualquer lacuna de datas >= 1 dia entre "hoje ou
        // depois" e o fim da trilha. A trilha SEMPRE precisa terminar numa
        // linha aberta (valid_until vazio) que cubra o futuro. Fronteira
        // INCLUSIVA: um termina 30/11 e outro começa 01/12 → SEM buraco (o dia
        // de fronteira pertence a uma só vigência). Rascunhos (linhas inativas)
        // e user_override continuam FORA dessa simulação — só são validados
        // quando definem vigência e são ativados.
        var localCoverageRows = []
        for (var localKi = 0; localKi < localConflicts.length; localKi++) {
          var localKRow = localConflicts[localKi]
          if (localPlanId && localKRow.id === localPlanId) continue
          localCoverageRows.push({
            name: String(localKRow.getString('name') || 'sem nome'),
            from: String(localKRow.getString('valid_from') || '').slice(0, 10),
            until: String(localKRow.getString('valid_until') || '').slice(0, 10),
          })
        }
        localCoverageRows.push({
          name: String(body.name || rec.getString('name') || 'novo plano'),
          from: localVFrom,
          until: localVUntil,
        })
        // v0.0.115 — CORREÇÃO do bug "Object has no member '__vigenciaCobertura'"
        // (a prova real da dona quebrou com 500 cru em inglês): a JSVM do
        // PocketBase NÃO compartilha o globalThis de forma confiável entre
        // módulos/hooks em todos os pools de VM — a chamada direta
        // globalThis.__vigenciaCobertura(...) lançava TypeError quando o pool
        // que executou a rota não tinha carregado o módulo que registra a
        // função. O consumidor agora resolve a função de forma DEFENSIVA
        // (typeof + try) e, indisponível, usa FALLBACK 100% INLINE com a
        // MESMA lógica (referência legível em
        // pocketbase/hooks/_vigencia_cobertura_reference.js). NUNCA depende
        // de ordem de carregamento de arquivos; nunca vaza 500 cru.
        var localCoberturaFn = null
        var localFallbackCobertura = null
        try {
          if (typeof globalThis !== 'undefined' && globalThis.__vigenciaCobertura) {
            localCoberturaFn = globalThis.__vigenciaCobertura
          }
        } catch (localCoberturaResolveErr) {
          console.log(
            '[admin_billing] globalThis.__vigenciaCobertura indisponível (' +
              localCoberturaResolveErr +
              ') — usando fallback inline v0.0.115.',
          )
        }
        // FALLBACK SEMPRE definido (independe do globalThis existir ou não).
        localFallbackCobertura = function (fallbackPlanType, fallbackRows) {
          var today = new Date().toISOString().slice(0, 10)
          var intervals = []
          for (var fi = 0; fi < fallbackRows.length; fi++) {
            var fr = fallbackRows[fi]
            if (!fr.from) continue
            if (fr.until && fr.until < today) continue
            intervals.push({ from: fr.from > today ? fr.from : today, until: fr.until || '' })
          }
          if (intervals.length === 0) {
            return (
              'A trilha ' +
              fallbackPlanType +
              ' ficaria SEM nenhum plano ativo a partir de hoje (' +
              today +
              ') — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível.'
            )
          }
          intervals.sort(function (a, b) {
            if (a.from < b.from) return -1
            if (a.from > b.from) return 1
            return 0
          })
          var cursor = ''
          for (var fj = 0; fj < intervals.length; fj++) {
            var fiv = intervals[fj]
            if (cursor === '') {
              if (fiv.from > today) {
                return (
                  'A trilha ' +
                  fallbackPlanType +
                  ' ficaria SEM nenhum plano ativo de hoje (' +
                  today +
                  ') até ' +
                  fiv.from +
                  ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar para se cadastrar não encontraria plano disponível. Inicie a nova vigência em ' +
                  today +
                  ' ou antes.'
                )
              }
            } else if (fiv.from > cursor) {
              return (
                'A trilha ' +
                fallbackPlanType +
                ' ficaria SEM cobertura entre ' +
                cursor +
                ' e ' +
                fiv.from +
                ' — nenhuma data futura pode ficar sem plano definido: um cliente que chegar nesse período (ex.: 03/12/2026) não encontraria plano disponível. Ajuste as vigências para que a trilha seja contínua (ex.: uma termina 30/11 e a próxima começa 01/12).'
              )
            }
            if (fiv.until === '') {
              cursor = ''
            } else if (cursor === '' || fiv.until > cursor) {
              cursor = fiv.until
            }
          }
          if (cursor === '') {
            return ''
          }
          return (
            'A trilha ' +
            fallbackPlanType +
            ' terminaria em ' +
            cursor +
            ' e ficaria SEM cobertura a partir do dia seguinte — a trilha precisa SEMPRE terminar numa linha SEM data final (em diante), para que todo o futuro continue coberto.'
          )
        }
        // v0.0.115 — resolve a função compartilhada de forma DEFENSIVA e, se
        // indisponível ou falhando, usa SEMPRE o fallback inline (mesma
        // lógica — ver _vigencia_cobertura_reference.js). Nunca 500 cru.
        if (!localCoberturaFn || typeof localCoberturaFn !== 'function') {
          localCoberturaFn = localFallbackCobertura
        }
        var localCoverageErr = ''
        try {
          localCoverageErr = localCoberturaFn(localPlanType, localCoverageRows) || ''
        } catch (localCoberturaCallErr) {
          console.log(
            '[admin_billing] __vigenciaCobertura falhou ao executar (' +
              localCoberturaCallErr +
              ') — usando fallback inline v0.0.115.',
          )
          localCoverageErr = localFallbackCobertura(localPlanType, localCoverageRows) || ''
        }
        if (localCoverageErr) {
          return e.json(400, { error: localCoverageErr })
        }
      }

      $app.save(rec)

      // v0.0.111: trilha de auditoria por plano (pedido da dona — gestão do
      // dia a dia). Uma linha em subscription_plans_audit por gravação bem
      // sucedida: criar/editar/definir_vigencia/importar, com antes→depois.
      try {
        var localAuditAction = 'editar'
        var localAuditChanges = []
        var localAuditFields = [
          ['price_cents', 'Preço'],
          ['valid_from', 'Vigência de'],
          ['valid_until', 'Vigência até'],
          ['active', 'Ativo'],
          ['stripe_price_id', 'Stripe Price ID'],
        ]
        if (!planId) {
          localAuditAction = 'criar'
        } else {
          var localHadVigenciaBefore =
            String(localPrevFrom || '') !== '' || String(localPrevUntil || '') !== ''
          var localHadVigenciaAfter = localVFrom !== '' || localVUntil !== ''
          if (localHadVigenciaAfter && (!localHadVigenciaBefore || localPrevActive === false)) {
            localAuditAction = 'definir_vigencia'
          }
        }
        for (var localFi = 0; localFi < localAuditFields.length; localFi++) {
          var localFId = localAuditFields[localFi][0]
          var localFLabel = localAuditFields[localFi][1]
          var localBefore = ''
          var localAfter = ''
          if (localFId === 'price_cents') {
            localBefore = String(localPrevCents || 0)
            localAfter = String(rec.getInt('price_cents') || 0)
            if (localBefore === localAfter) continue
          } else if (localFId === 'active') {
            localBefore = localPrevActive ? 'true' : 'false'
            localAfter = rec.getBool('active') ? 'true' : 'false'
            if (localBefore === localAfter) continue
          } else {
            localBefore = String(localPrevMap[localFId] || '')
            localAfter = String(rec.getString(localFId) || '')
            if (localBefore === localAfter) continue
          }
          localAuditChanges.push({
            campo: localFId,
            label: localFLabel,
            antes: localBefore,
            depois: localAfter,
          })
        }
        var localAuditCol = $app.findCollectionByNameOrId('subscription_plans_audit')
        var localAuditRec = new Record(localAuditCol)
        localAuditRec.set('plan', rec.id)
        localAuditRec.set('plan_name', rec.getString('name') || '')
        localAuditRec.set('action', localAuditAction)
        localAuditRec.set('actor_email', email || 'admin')
        localAuditRec.set('changes', JSON.stringify(localAuditChanges))
        $app.save(localAuditRec)
      } catch (localAuditErr) {
        console.log('[admin_billing] Auditoria falhou (plano salvo, sem trilha): ' + localAuditErr)
      }

      return e.json(200, {
        success: true,
        message: 'Plano salvo com sucesso!',
        id: rec.id,
      })
    } catch (err) {
      // v0.0.104: repassa o status/mensagem do erro de validação (hook de
      // vigência lança BadRequestError) — antes virava 500 genérico e o
      // Backoffice exibia "Something went wrong" sem a mensagem amigável.
      var localStatus = 500
      var localMsg = 'Falha ao salvar plano. Tente novamente.'
      try {
        if (err && err.hasOwnProperty('status') && err.status > 0) localStatus = err.status
        if (err && err.hasOwnProperty('message') && err.message) localMsg = err.message
      } catch (_) {}
      console.log('[admin_billing] Erro ao salvar plano (' + localStatus + '): ' + err)
      return e.json(localStatus, { success: false, error: localMsg, message: localMsg })
    }
  },
  $apis.requireAuth(),
)

// ----------------------------------------------------
// 11.b (v0.0.111) GET /backend/v1/admin/billing/plans/history?plan_id=...
// Trilha de auditoria de um plano (coleção subscription_plans_audit, coleção
// criada na migração 0052), mais recente primeiro. Somente admins.
// Regras JSVM: lógica 100% INLINE no callback.
// ----------------------------------------------------
routerAdd(
  'GET',
  '/backend/v1/admin/billing/plans/history',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      const localPlanId = String(e.requestInfo().query.plan_id || '')
      if (!localPlanId) {
        return e.json(400, { error: 'Parâmetro plan_id é obrigatório.' })
      }

      const localFilter = "plan = '" + localPlanId + "'"
      const localRows = $app.findRecordsByFilter(
        'subscription_plans_audit',
        localFilter,
        '-created',
        100,
        0,
      )
      const localOut = []
      for (let localHi = 0; localHi < localRows.length; localHi++) {
        const localRow = localRows[localHi]
        let localChanges = []
        try {
          const localRaw = localRow.getString('changes') || '[]'
          const localParsed = JSON.parse(localRaw)
          if (localParsed && typeof localParsed === 'object' && localParsed.length !== undefined) {
            localChanges = localParsed
          }
        } catch (_) {
          localChanges = []
        }
        localOut.push({
          id: localRow.id,
          action: localRow.getString('action') || '',
          plan_name: localRow.getString('plan_name') || '',
          actor_email: localRow.getString('actor_email') || '',
          created: localRow.getString('created') || '',
          changes: localChanges,
        })
      }

      return e.json(200, { history: localOut })
    } catch (err) {
      console.log('[admin_billing] Erro em /plans/history: ' + err)
      return e.json(500, { error: 'Falha ao carregar histórico do plano.' })
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
          // v0.0.105: pagamento único (one_time Pix/cartão) — a ausência de
          // stripe_subscription_id é o comportamento correto desde a v0.0.95;
          // o Backoffice usa billing_mode/payment_paid_at para não exibir
          // "Sem assinatura Stripe" para quem pagou à vista.
          billing_mode: u.getString('billing_mode') || '',
          payment_amount_cents: u.getInt('payment_amount_cents'),
          payment_paid_at: u.getString('payment_paid_at') || '',
          access_until: u.getString('access_until') || u.getString('subscription_expires_at') || '',
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

// ----------------------------------------------------
// 14. (v0.0.109) A rota de diagnóstico test-vigencia e o cron temporário
// vigencia_selftest foram REMOVIDOS nesta rodada de limpeza — a regra de
// vigência já está comprovada via API real (fronteira inclusiva, v0.0.107/
// v0.0.108) e a validação real permanece 100% na rota POST
// /backend/v1/admin/billing/plans e no hook subscription_plans_vigencia.js.
// ----------------------------------------------------

// ----------------------------------------------------
// 15. (v0.0.110) POST /backend/v1/admin/billing/stripe/import-prices
// Importa os Prices do produto Consciente direto da API da Stripe como linhas
// RASCUNHO em subscription_plans: active=false, valid_from/valid_until VAZIOS,
// stripe_price_id preenchido e label a partir da Stripe (apelido/nome do
// produto + valor em R$ + periodicidade mensal/anual). Price já referenciado
// por QUALQUER linha (comparação por stripe_price_id) é pulado e contado como
// "já existente" — nunca duplica. Rascunho fica fora da oferta até a dona
// ativar com vigência; o hook de vigência ignora linhas inativas (regra
// existente preservada — cenário AR).
// Regras JSVM: lógica 100% INLINE no callback (sem require, sem variável de
// try usada fora).
// ----------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/admin/billing/stripe/import-prices',
  (e) => {
    try {
      const authUser = e.auth
      const email = authUser ? authUser.getString('email') : ''
      const role = authUser ? authUser.getString('role') : ''
      const isAdmin = email === 'barbara.ferreira.leal@gmail.com' || role === 'admin'
      if (!isAdmin) {
        return e.json(403, { error: 'Acesso restrito à administração' })
      }

      function inlineGetStripeSecret() {
        try {
          const records = $app.findRecordsByFilter('stripe_config', '', '-created', 1, 0)
          if (records.length > 0) {
            return (records[0].getString('secret_key') || '').trim()
          }
        } catch (err) {
          console.log('[import_prices] Erro ao carregar stripe_config: ' + err)
        }
        return ''
      }

      function inlineStripeGet(secretKey, path) {
        const res = $http.send({
          url: 'https://api.stripe.com/v1' + path,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + secretKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30,
        })
        // $http.send na JSVM: { statusCode, headers, cookies, body, raw, json } —
        // res.rawText NÃO existe; usar res.json (parseado) ou JSON.parse(res.raw).
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
        } catch (_) {
          data = null
        }
        return { statusCode: res.statusCode, data: data }
      }

      function inlineFormatBRL(cents) {
        return 'R$ ' + ((cents || 0) / 100).toFixed(2).replace('.', ',')
      }

      const localSecret = inlineGetStripeSecret()
      if (!localSecret) {
        return e.json(400, {
          error:
            'A secret key da Stripe ainda não foi configurada. Preencha em Billing → Configuração Stripe antes de importar os preços.',
        })
      }

      // 1. Localiza o produto "Consciente" na conta Stripe
      const prodRes = inlineStripeGet(localSecret, '/products?limit=100&active=true')
      if (prodRes.statusCode >= 400 || !prodRes.data) {
        console.log('[import_prices] Falha ao listar produtos: ' + prodRes.statusCode)
        return e.json(502, {
          error:
            'Não foi possível consultar a Stripe (produtos). Verifique a secret key na Configuração Stripe e tente novamente.',
        })
      }
      let localProductId = ''
      let localProductName = ''
      const localProducts = prodRes.data.data || []
      for (let pi = 0; pi < localProducts.length; pi++) {
        if (
          String(localProducts[pi].name || '')
            .toLowerCase()
            .indexOf('consciente') !== -1
        ) {
          localProductId = String(localProducts[pi].id || '')
          localProductName = String(localProducts[pi].name || '')
          break
        }
      }
      if (!localProductId) {
        return e.json(404, {
          error:
            'Nenhum produto "Consciente" foi encontrado na conta Stripe. Crie o produto na Stripe antes de importar os preços.',
        })
      }

      // 2. Lista os Prices do produto (até 4 páginas de 100)
      const localPriceList = []
      let localStartingAfter = ''
      for (let page = 0; page < 4; page++) {
        let localPath =
          '/prices?limit=100&active=true&product=' + encodeURIComponent(localProductId)
        if (localStartingAfter) {
          localPath += '&starting_after=' + encodeURIComponent(localStartingAfter)
        }
        const priceRes = inlineStripeGet(localSecret, localPath)
        if (priceRes.statusCode >= 400 || !priceRes.data) {
          console.log('[import_prices] Falha ao listar prices: ' + priceRes.statusCode)
          return e.json(502, {
            error:
              'Não foi possível consultar a Stripe (preços). Verifique a secret key na Configuração Stripe e tente novamente.',
          })
        }
        const localData = priceRes.data.data || []
        for (let li = 0; li < localData.length; li++) {
          localPriceList.push(localData[li])
        }
        if (priceRes.data.has_more && localData.length > 0) {
          localStartingAfter = String(localData[localData.length - 1].id || '')
        } else {
          break
        }
      }

      // 3. Prices já referenciados em QUALQUER linha de subscription_plans
      const localPlans = $app.findRecordsByFilter('subscription_plans', '', '-created', 500, 0)
      const localExistingMap = {}
      for (let xi = 0; xi < localPlans.length; xi++) {
        const localPid = localPlans[xi].getString('stripe_price_id') || ''
        if (localPid) {
          localExistingMap[localPid] = true
        }
      }

      const plansCol = $app.findCollectionByNameOrId('subscription_plans')
      let localImported = 0
      let localAlready = 0
      const localImportedNames = []

      for (let idx = 0; idx < localPriceList.length; idx++) {
        const localPrice = localPriceList[idx]
        const localPriceId = String(localPrice.id || '')
        if (!localPriceId) continue
        if (localExistingMap[localPriceId]) {
          localAlready++
          continue
        }

        const localCents = localPrice.unit_amount || 0
        const localInterval =
          localPrice.recurring && typeof localPrice.recurring === 'object'
            ? String(localPrice.recurring.interval || '')
            : ''
        if (!localCents) continue
        if (localInterval !== 'month' && localInterval !== 'year') {
          // Prices sem recorrência (one-time) ou com periodicidade não suportada
          // não viram plano de assinatura
          continue
        }
        const localPlanType = localInterval === 'year' ? 'anual' : 'mensal'

        let localProdName = ''
        if (localPrice.product && typeof localPrice.product === 'object') {
          localProdName = String(localPrice.product.name || '')
        }
        const localNickname = String(localPrice.nickname || '')
        const localBaseName =
          localNickname || localProdName || localProductName || 'Plano Consciente'
        const localLabel =
          localBaseName +
          ' (' +
          inlineFormatBRL(localCents) +
          (localPlanType === 'anual' ? '/ano' : '/mês') +
          ')'

        // marca já visto antes de salvar: duas chamadas seguidas (ou dois Prices
        // iguais na mesma página) nunca geram rascunho duplicado
        localExistingMap[localPriceId] = true

        const localRec = new Record(plansCol)
        localRec.set('plan_type', localPlanType)
        localRec.set('name', localLabel)
        localRec.set('price_cents', localCents)
        localRec.set('stripe_price_id', localPriceId)
        localRec.set(
          'stripe_product_id',
          localPrice.product && typeof localPrice.product === 'object'
            ? String(localPrice.product.id || '')
            : String(localPrice.product || ''),
        )
        localRec.set('valid_from', '')
        localRec.set('valid_until', '')
        localRec.set('user_override', '')
        localRec.set('active', false)
        localRec.set(
          'notes',
          'Rascunho importado da Stripe (v0.0.110) — defina a vigência e ative.',
        )
        $app.save(localRec)

        // v0.0.111: auditoria — importação vira linha 'importar' na trilha
        try {
          var localAuditCol = $app.findCollectionByNameOrId('subscription_plans_audit')
          var localAuditRec = new Record(localAuditCol)
          localAuditRec.set('plan', localRec.id)
          localAuditRec.set('plan_name', localLabel)
          localAuditRec.set('action', 'importar')
          localAuditRec.set('actor_email', email || 'admin')
          localAuditRec.set(
            'changes',
            JSON.stringify([
              {
                campo: 'stripe_price_id',
                label: 'Stripe Price ID',
                antes: '',
                depois: localPriceId,
              },
            ]),
          )
          $app.save(localAuditRec)
        } catch (localAuditErr) {
          console.log('[import_prices] Auditoria falhou (importado, sem trilha): ' + localAuditErr)
        }

        localImported++
        localImportedNames.push(localLabel)
      }

      const localMessage =
        localImported +
        ' preço(s) importado(s) como rascunho, ' +
        localAlready +
        ' já existente(s) na tabela de planos.'
      console.log('[import_prices] Resumo: ' + localMessage)
      return e.json(200, {
        success: true,
        imported: localImported,
        already_existing: localAlready,
        total_stripe_prices: localPriceList.length,
        imported_names: localImportedNames,
        message: localMessage,
      })
    } catch (err) {
      console.log('[import_prices] Erro: ' + err)
      return e.json(500, { error: 'Falha ao importar preços da Stripe. Tente novamente.' })
    }
  },
  $apis.requireAuth(),
)
