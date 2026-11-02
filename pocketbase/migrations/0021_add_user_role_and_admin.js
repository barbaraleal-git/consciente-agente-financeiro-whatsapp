/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['client', 'admin'],
          maxSelect: 1,
        }),
      )
    }

    // Trava para impedir que o usuário altere seu próprio papel:
    // @request.body.role:changed = false
    usersCol.updateRule = 'id = @request.auth.id && @request.body.role:changed = false'

    app.save(usersCol)

    // Promove a dona do produto (Barbara) para admin se existir
    try {
      const barbara = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'barbara.ferreira.leal@gmail.com',
      )
      barbara.set('role', 'admin')
      app.save(barbara)
      console.log(
        '[migration 0021] barbara.ferreira.leal@gmail.com promovida para admin com sucesso.',
      )
    } catch (_) {
      console.log(
        '[migration 0021] Barbara ainda não existe no banco, promoção ocorrerá no login/seed.',
      )
    }

    // Garante que outros usuários sem role definida fiquem como 'client'
    try {
      app
        .db()
        .newQuery("UPDATE users SET role = 'client' WHERE role IS NULL OR role = ''")
        .execute()
      app
        .db()
        .newQuery("UPDATE users SET role = 'admin' WHERE email = 'barbara.ferreira.leal@gmail.com'")
        .execute()
    } catch (e) {
      console.log('[migration 0021] Aviso ao atualizar roles legadas:', e)
    }
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const rf = usersCol.fields.getByName('role')
      if (rf) usersCol.fields.remove(rf)
      usersCol.updateRule = 'id = @request.auth.id'
      app.save(usersCol)
    } catch (_) {}
  },
)
