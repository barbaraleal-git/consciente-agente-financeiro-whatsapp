/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCollection.id

    // 1. categories
    const categories = new Collection({
      name: 'categories',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['despesa', 'receita', 'investimento'],
          maxSelect: 1,
        },
        { name: 'icon', type: 'text', required: true },
        { name: 'color', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_categories_owner_type ON categories (owner, type)'],
    })
    app.save(categories)

    // 2. transactions
    const transactions = new Collection({
      name: 'transactions',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'description', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true, onlyInt: true },
        { name: 'date', type: 'date', required: true },
        {
          name: 'category',
          type: 'relation',
          required: true,
          collectionId: categories.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['despesa', 'receita', 'investimento'],
          maxSelect: 1,
        },
        {
          name: 'source',
          type: 'select',
          required: true,
          values: ['manual', 'whatsapp', 'import', 'agent'],
          maxSelect: 1,
        },
        { name: 'note', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_transactions_owner_date ON transactions (owner, date DESC)',
        'CREATE INDEX idx_transactions_category ON transactions (category)',
        'CREATE INDEX idx_transactions_type ON transactions (type)',
      ],
    })
    app.save(transactions)

    // 3. budgets
    const budgets = new Collection({
      name: 'budgets',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'category',
          type: 'relation',
          required: true,
          collectionId: categories.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'month', type: 'text', required: true },
        { name: 'amount', type: 'number', required: true, onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_budgets_owner_month ON budgets (owner, month)',
        'CREATE INDEX idx_budgets_category ON budgets (category)',
      ],
    })
    app.save(budgets)

    // 4. import_jobs
    const importJobs = new Collection({
      name: 'import_jobs',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'filename', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pending', 'processing', 'done', 'failed'],
          maxSelect: 1,
        },
        { name: 'total_lines', type: 'number', onlyInt: true },
        { name: 'imported_count', type: 'number', onlyInt: true },
        { name: 'raw_content', type: 'text' },
        { name: 'error', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_import_jobs_owner_status ON import_jobs (owner, status)'],
    })
    app.save(importJobs)

    // 5. alerts
    const alerts = new Collection({
      name: 'alerts',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'message', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['budget', 'info', 'warning'],
          maxSelect: 1,
        },
        { name: 'read', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_alerts_owner_read ON alerts (owner, read)'],
    })
    app.save(alerts)

    // 6. whatsapp_status
    const whatsappStatus = new Collection({
      name: 'whatsapp_status',
      type: 'base',
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
      fields: [
        {
          name: 'owner',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'connected', type: 'bool' },
        { name: 'phone_number', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_whatsapp_status_owner ON whatsapp_status (owner)'],
    })
    app.save(whatsappStatus)
  },
  (app) => {
    const toDelete = [
      'whatsapp_status',
      'alerts',
      'import_jobs',
      'budgets',
      'transactions',
      'categories',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
