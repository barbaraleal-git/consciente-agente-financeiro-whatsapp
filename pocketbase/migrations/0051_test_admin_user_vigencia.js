/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0051 — Usuário admin de teste para validação via API real da
 * rota POST /backend/v1/admin/billing/plans (regra de vigência com fronteira
 * inclusiva, v0.0.107).
 *
 * A credencial admin real (barbara.ferreira.leal@gmail.com) NÃO está
 * disponível (nenhuma env com senha). Para provar a regra contra o backend
 * vivo a usuária exige chamada HTTP autenticada real — este usuário é
 * dedicado a isso, com role=admin e e-mail sintético claramente marcado.
 * Idempotente: atualiza a senha se o registro já existir (senha pode ter
 * mudado entre rodadas), nunca duplica.
 */
migrate(
  (app) => {
    const email = 'test.vigencia@consciente-teste.internal'
    const pass = 'Vigencia107!Teste'
    let rec = null
    try {
      rec = app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {
      rec = null
    }
    if (!rec) {
      rec = new Record(app.findCollectionByNameOrId('_pb_users_auth_'))
      rec.setEmail(email)
      rec.setPassword(pass)
      rec.setVerified(true)
      rec.set('role', 'admin')
      rec.set('name', 'Teste Vigência (admin de teste)')
      rec.set('subscription_status', 'trial')
      app.save(rec)
      console.log('[migration 0051] Usuário admin de teste criado: ' + email)
    } else {
      rec.setPassword(pass)
      rec.set('role', 'admin')
      app.save(rec)
      console.log('[migration 0051] Usuário admin de teste já existe — senha/role reafirmadas.')
    }
  },
  (app) => {
    console.log('[migration 0051] down: no-op (usuário de teste mantido).')
  },
)
