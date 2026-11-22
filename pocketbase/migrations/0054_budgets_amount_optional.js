// v0.0.139 — Caixinha criada via WhatsApp nasce com teto R$ 0.
// O campo `amount` da coleção `budgets` era `required: true`: o PocketBase
// trata 0 num campo number required como valor vazio e rejeita a criação com
// "amount: cannot be blank" — que é exatamente o GoError visto nos logs do
// hook em 21:13 (criação de caixinha via WhatsApp durante pendência).
// Deixando o campo opcional, a caixinha nasce sem teto (aviso de teto só
// aparece quando ela tem valor), comportamento já validado com a dona.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('budgets')
    const amountField = col.fields.getByName('amount')
    if (amountField) {
      amountField.required = false
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('budgets')
    const amountField = col.fields.getByName('amount')
    if (amountField) {
      amountField.required = true
      app.save(col)
    }
  },
)
