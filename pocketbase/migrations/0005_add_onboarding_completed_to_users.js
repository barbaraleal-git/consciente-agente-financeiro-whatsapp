/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('onboarding_completed')) {
      users.fields.add(
        new BoolField({
          name: 'onboarding_completed',
          required: false,
        }),
      )
      app.save(users)
    }

    // Set existing seed user (Bárbara Leal) as onboarding_completed = true so existing seed user does NOT see onboarding
    try {
      const seededUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'barbara.ferreira.leal@gmail.com',
      )
      seededUser.set('onboarding_completed', true)
      app.save(seededUser)
    } catch (_) {}
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (users.fields.getByName('onboarding_completed')) {
      users.fields.removeByName('onboarding_completed')
      app.save(users)
    }
  },
)
