/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0036:
 * Módulo de Assinatura, Cobrança Recorrente (Stripe), Preços Parametrizáveis,
 * Dados Legais da Empresa (Decreto 7.962/2013) e Cadastro Completo do Cliente.
 */
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCollection.id

    // 1. Novos campos em _pb_users_auth_ para conformidade cadastral e controle de assinatura
    // - full_name (texto)
    // - cpf (texto, com digitos normalizados)
    // - birth_date (data de nascimento para checar maioridade 18+)
    // - zip_code, street, number, complement, neighborhood, city, state (endereço completo)
    // - terms_accepted_at (data/hora do aceite dos Termos de Uso e Política de Privacidade)
    // - recurring_consent_accepted_at (data/hora do consentimento expresso de recorrência)
    // - subscription_status (select: 'trial' | 'active' | 'carencia' | 'bloqueado' | 'cancelado')
    // - subscription_plan (select: 'mensal' | 'anual')
    // - subscription_expires_at (date)
    // - carencia_until (date, fim da carência de 7 dias)
    // - stripe_customer_id (texto)
    // - stripe_subscription_id (texto)
    try {
      const userFields = usersCollection.fields || []
      const existingNames = {}
      for (let i = 0; i < userFields.length; i++) {
        existingNames[userFields[i].name] = true
      }

      if (!existingNames['full_name']) {
        usersCollection.fields.add(new TextField({ name: 'full_name', required: false }))
      }
      if (!existingNames['cpf']) {
        usersCollection.fields.add(new TextField({ name: 'cpf', required: false }))
      }
      if (!existingNames['birth_date']) {
        usersCollection.fields.add(new TextField({ name: 'birth_date', required: false }))
      }
      if (!existingNames['zip_code']) {
        usersCollection.fields.add(new TextField({ name: 'zip_code', required: false }))
      }
      if (!existingNames['street']) {
        usersCollection.fields.add(new TextField({ name: 'street', required: false }))
      }
      if (!existingNames['number']) {
        usersCollection.fields.add(new TextField({ name: 'number', required: false }))
      }
      if (!existingNames['complement']) {
        usersCollection.fields.add(new TextField({ name: 'complement', required: false }))
      }
      if (!existingNames['neighborhood']) {
        usersCollection.fields.add(new TextField({ name: 'neighborhood', required: false }))
      }
      if (!existingNames['city']) {
        usersCollection.fields.add(new TextField({ name: 'city', required: false }))
      }
      if (!existingNames['state']) {
        usersCollection.fields.add(new TextField({ name: 'state', required: false }))
      }
      if (!existingNames['terms_accepted_at']) {
        usersCollection.fields.add(new TextField({ name: 'terms_accepted_at', required: false }))
      }
      if (!existingNames['recurring_consent_accepted_at']) {
        usersCollection.fields.add(
          new TextField({ name: 'recurring_consent_accepted_at', required: false }),
        )
      }
      if (!existingNames['subscription_status']) {
        usersCollection.fields.add(
          new SelectField({
            name: 'subscription_status',
            required: false,
            values: ['trial', 'active', 'carencia', 'bloqueado', 'cancelado'],
            maxSelect: 1,
          }),
        )
      }
      if (!existingNames['subscription_plan']) {
        usersCollection.fields.add(
          new SelectField({
            name: 'subscription_plan',
            required: false,
            values: ['mensal', 'anual'],
            maxSelect: 1,
          }),
        )
      }
      if (!existingNames['subscription_expires_at']) {
        usersCollection.fields.add(
          new TextField({ name: 'subscription_expires_at', required: false }),
        )
      }
      if (!existingNames['carencia_until']) {
        usersCollection.fields.add(new TextField({ name: 'carencia_until', required: false }))
      }
      if (!existingNames['stripe_customer_id']) {
        usersCollection.fields.add(new TextField({ name: 'stripe_customer_id', required: false }))
      }
      if (!existingNames['stripe_subscription_id']) {
        usersCollection.fields.add(
          new TextField({ name: 'stripe_subscription_id', required: false }),
        )
      }

      app.save(usersCollection)
      console.log('[migration 0036] Campos de cadastro e assinatura adicionados a users.')
    } catch (uErr) {
      console.log('[migration 0036] Erro ao atualizar campos de users:', uErr)
    }

    // 2. Coleção subscription_plans (Preços parametrizáveis com vigência geral e por cliente)
    // plan_type: 'mensal' | 'anual'
    // name: ex: "Mensal Black November", "Anual Black November", "Mensal Padrão"
    // price_cents: valor em centavos (ex: 1990 para R$ 19,90)
    // stripe_price_id: ID do preço na Stripe (opcional, preenchido via integração)
    // stripe_product_id: ID do produto na Stripe
    // valid_from: data/hora início de vigência (YYYY-MM-DD ou ISO)
    // valid_until: data/hora fim de vigência (opcional)
    // user_override: relação opcional com _pb_users_auth_ (para cliente com desconto especial negociado)
    // active: bool
    try {
      let plansCol = null
      try {
        plansCol = app.findCollectionByNameOrId('subscription_plans')
      } catch (_) {}

      if (!plansCol) {
        plansCol = new Collection({
          name: 'subscription_plans',
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          updateRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          deleteRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          fields: [
            {
              name: 'plan_type',
              type: 'select',
              required: true,
              values: ['mensal', 'anual'],
              maxSelect: 1,
            },
            { name: 'name', type: 'text', required: true },
            { name: 'price_cents', type: 'number', required: true, onlyInt: true },
            { name: 'stripe_price_id', type: 'text' },
            { name: 'stripe_product_id', type: 'text' },
            { name: 'valid_from', type: 'text', required: true },
            { name: 'valid_until', type: 'text' },
            {
              name: 'user_override',
              type: 'relation',
              required: false,
              collectionId: usersId,
              cascadeDelete: false,
              maxSelect: 1,
            },
            { name: 'active', type: 'bool' },
            { name: 'notes', type: 'text' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: [
            'CREATE INDEX idx_plans_type_active ON subscription_plans (plan_type, active)',
            'CREATE INDEX idx_plans_override ON subscription_plans (user_override)',
          ],
        })
        app.save(plansCol)
        console.log('[migration 0036] Coleção subscription_plans criada.')
      }

      // Seed dos planos oficiais iniciais:
      // 1. Mensal Black November: R$ 19,90/mês (1990 centavos)
      // 2. Anual Black November: R$ 214,90/ano (21490 centavos)
      // 3. Mensal Padrão (Dez/2026 em diante): R$ 29,90/mês (2990 centavos)
      // 4. Anual Padrão (Dez/2026 em diante): R$ 322,90/ano (32290 centavos)
      const existingPlans = app.findRecordsByFilter('subscription_plans', '', '-created', 10, 0)
      if (existingPlans.length === 0) {
        const p1 = new Record(plansCol)
        p1.set('plan_type', 'mensal')
        p1.set('name', 'Mensal (Black November)')
        p1.set('price_cents', 1990)
        p1.set('valid_from', '2024-01-01')
        p1.set('valid_until', '2026-11-30')
        p1.set('active', true)
        p1.set('notes', 'Promoção especial de lançamento / Black November')
        app.save(p1)

        const p2 = new Record(plansCol)
        p2.set('plan_type', 'anual')
        p2.set('name', 'Anual (Black November)')
        p2.set('price_cents', 21490)
        p2.set('valid_from', '2024-01-01')
        p2.set('valid_until', '2026-11-30')
        p2.set('active', true)
        p2.set('notes', 'Promoção especial anual de lançamento / Black November (10% desc.)')
        app.save(p2)

        const p3 = new Record(plansCol)
        p3.set('plan_type', 'mensal')
        p3.set('name', 'Mensal Padrão')
        p3.set('price_cents', 2990)
        p3.set('valid_from', '2026-12-01')
        p3.set('valid_until', '')
        p3.set('active', true)
        p3.set('notes', 'Preço regular a partir de Dezembro/2026')
        app.save(p3)

        const p4 = new Record(plansCol)
        p4.set('plan_type', 'anual')
        p4.set('name', 'Anual Padrão')
        p4.set('price_cents', 32290)
        p4.set('valid_from', '2026-12-01')
        p4.set('valid_until', '')
        p4.set('active', true)
        p4.set('notes', 'Preço regular anual a partir de Dezembro/2026 (10% desc.)')
        app.save(p4)

        console.log('[migration 0036] Planos iniciais criados com sucesso.')
      }
    } catch (planErr) {
      console.log('[migration 0036] Erro ao criar subscription_plans:', planErr)
    }

    // 3. Coleção company_legal_info (Dados Legais da Empresa para exibição no checkout e públicas - Decreto 7.962/2013)
    // company_name: Razão Social (ex: Eleva Tecnologia e Finanças Ltda)
    // trade_name: Nome Fantasia (ex: Consciente)
    // cnpj: CNPJ da empresa
    // address_full: Endereço físico completo
    // email_contact: E-mail de contato / suporte
    // support_phone_or_bot: Telefone / link WhatsApp do suporte
    // terms_version: Versão atual dos termos de uso
    // privacy_version: Versão atual da política de privacidade
    // trial_days_default: Dias de trial gratuito para novos cadastros (default: 7)
    // carencia_days_default: Dias de carência para pagamento falhado (default: 7)
    try {
      let legalCol = null
      try {
        legalCol = app.findCollectionByNameOrId('company_legal_info')
      } catch (_) {}

      if (!legalCol) {
        legalCol = new Collection({
          name: 'company_legal_info',
          type: 'base',
          listRule: '', // Público para exibição no checkout e rodapés legais (Decreto 7.962/2013)
          viewRule: '',
          createRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          updateRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          deleteRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          fields: [
            { name: 'company_name', type: 'text', required: true },
            { name: 'trade_name', type: 'text', required: true },
            { name: 'cnpj', type: 'text', required: true },
            { name: 'address_full', type: 'text', required: true },
            { name: 'email_contact', type: 'text', required: true },
            { name: 'support_phone_or_bot', type: 'text' },
            { name: 'terms_version', type: 'text' },
            { name: 'privacy_version', type: 'text' },
            { name: 'trial_days_default', type: 'number', onlyInt: true },
            { name: 'carencia_days_default', type: 'number', onlyInt: true },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
        })
        app.save(legalCol)
        console.log('[migration 0036] Coleção company_legal_info criada.')
      }

      // Seed inicial de dados legais (parametrizável no backoffice)
      const existingLegal = app.findRecordsByFilter('company_legal_info', '', '-created', 1, 0)
      if (existingLegal.length === 0) {
        const legalRec = new Record(legalCol)
        legalRec.set('company_name', 'Consciente Gestão Financeira Inteligente Ltda.')
        legalRec.set('trade_name', 'Consciente - Seu parceiro nas finanças')
        legalRec.set('cnpj', '53.842.190/0001-38')
        legalRec.set(
          'address_full',
          'Av. Paulista, 1000, Bela Vista, São Paulo - SP, CEP 01310-100',
        )
        legalRec.set('email_contact', 'contato@consciente.app.br')
        legalRec.set('support_phone_or_bot', '+55 (11) 94998-9868')
        legalRec.set('terms_version', 'v1.0-2026')
        legalRec.set('privacy_version', 'v1.0-2026')
        legalRec.set('trial_days_default', 7)
        legalRec.set('carencia_days_default', 7)
        app.save(legalRec)
        console.log('[migration 0036] Registro seed de company_legal_info criado.')
      }
    } catch (legErr) {
      console.log('[migration 0036] Erro ao criar company_legal_info:', legErr)
    }

    // 4. Coleção subscriptions_history (log de auditoria de pagamentos, cobranças e trocas de status)
    try {
      let subHistCol = null
      try {
        subHistCol = app.findCollectionByNameOrId('subscriptions_history')
      } catch (_) {}

      if (!subHistCol) {
        subHistCol = new Collection({
          name: 'subscriptions_history',
          type: 'base',
          listRule:
            "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          viewRule:
            "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          createRule: "@request.auth.id != ''",
          updateRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          deleteRule:
            "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'barbara.ferreira.leal@gmail.com')",
          fields: [
            {
              name: 'user',
              type: 'relation',
              required: true,
              collectionId: usersId,
              cascadeDelete: true,
              maxSelect: 1,
            },
            { name: 'event_type', type: 'text', required: true },
            { name: 'plan_type', type: 'text' },
            { name: 'amount_cents', type: 'number', onlyInt: true },
            { name: 'status_from', type: 'text' },
            { name: 'status_to', type: 'text' },
            { name: 'stripe_event_id', type: 'text' },
            { name: 'details', type: 'json' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: [
            'CREATE INDEX idx_sub_hist_user ON subscriptions_history (user)',
            'CREATE INDEX idx_sub_hist_event ON subscriptions_history (event_type)',
          ],
        })
        app.save(subHistCol)
        console.log('[migration 0036] Coleção subscriptions_history criada.')
      }
    } catch (histErr) {
      console.log('[migration 0036] Erro ao criar subscriptions_history:', histErr)
    }

    // 5. Garantir que usuários existentes tenham status 'trial' ou 'active'
    try {
      const allUsers = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 100, 0)
      for (let i = 0; i < allUsers.length; i++) {
        const u = allUsers[i]
        const st = u.getString('subscription_status')
        if (!st) {
          // Usuários admin ou antigos iniciam como ativos ou trial
          const isAdmin =
            u.getString('email') === 'barbara.ferreira.leal@gmail.com' ||
            u.getString('role') === 'admin'
          u.set('subscription_status', isAdmin ? 'active' : 'trial')
          const nowPlus7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          u.set('subscription_expires_at', nowPlus7)
          app.save(u)
        }
      }
    } catch (_) {}
  },
  (app) => {
    // Reversão
    try {
      const c1 = app.findCollectionByNameOrId('company_legal_info')
      app.delete(c1)
    } catch (_) {}
    try {
      const c2 = app.findCollectionByNameOrId('subscription_plans')
      app.delete(c2)
    } catch (_) {}
    try {
      const c3 = app.findCollectionByNameOrId('subscriptions_history')
      app.delete(c3)
    } catch (_) {}
  },
)
