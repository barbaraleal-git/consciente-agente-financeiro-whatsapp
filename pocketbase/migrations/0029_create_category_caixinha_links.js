/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCollection.id

    const budgetsCollection = app.findCollectionByNameOrId('budgets')
    const budgetsId = budgetsCollection.id

    // Coleção para parametrização N:N de vínculos categoria↔caixinha por cliente
    // user: relação com _pb_users_auth_ (owner)
    // budget: relação com budgets (caixinha)
    // category_name: texto com o nome ou identificador da categoria (ex: "Alimentação Essencial", "Alimentação - VA")
    // category_id: texto opcional caso a categoria exista na tabela categories
    // active: bool se o vínculo está ativo
    const categoryCaixinhaLinks = new Collection({
      name: 'category_caixinha_links',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'budget',
          type: 'relation',
          required: true,
          collectionId: budgetsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'category_name', type: 'text', required: true },
        { name: 'category_id', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_cat_links_user ON category_caixinha_links (user)',
        'CREATE INDEX idx_cat_links_budget ON category_caixinha_links (budget)',
        'CREATE INDEX idx_cat_links_user_budget ON category_caixinha_links (user, budget)',
      ],
    })
    app.save(categoryCaixinhaLinks)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('category_caixinha_links')
      app.delete(col)
    } catch (_) {}
  },
)
