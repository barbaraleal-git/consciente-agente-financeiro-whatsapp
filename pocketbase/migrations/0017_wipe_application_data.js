/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Preservar o registro whatsapp_status
    // Remover o campo owner caso esteja preenchido com usuário a ser deletado
    const wsRecords = app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
    for (let i = 0; i < wsRecords.length; i++) {
      const ws = wsRecords[i]
      if (ws.getString('owner')) {
        ws.set('owner', '')
        app.save(ws)
      }
    }

    // 2. Apagar transações
    try {
      const txs = app.findRecordsByFilter('transactions', '', '-created', 1000, 0)
      for (let i = 0; i < txs.length; i++) {
        app.delete(txs[i])
      }
    } catch (e) {
      console.log('[migration 0017] Erro ao deletar transactions:', e)
    }

    // 3. Apagar budgets
    try {
      const bgs = app.findRecordsByFilter('budgets', '', '-created', 1000, 0)
      for (let i = 0; i < bgs.length; i++) {
        app.delete(bgs[i])
      }
    } catch (e) {
      console.log('[migration 0017] Erro ao deletar budgets:', e)
    }

    // 4. Apagar alerts
    try {
      const als = app.findRecordsByFilter('alerts', '', '-created', 1000, 0)
      for (let i = 0; i < als.length; i++) {
        app.delete(als[i])
      }
    } catch (e) {
      console.log('[migration 0017] Erro ao deletar alerts:', e)
    }

    // 5. Apagar import_jobs
    try {
      const ijs = app.findRecordsByFilter('import_jobs', '', '-created', 1000, 0)
      for (let i = 0; i < ijs.length; i++) {
        app.delete(ijs[i])
      }
    } catch (e) {
      console.log('[migration 0017] Erro ao deletar import_jobs:', e)
    }

    // 6. Apagar categories
    try {
      const cats = app.findRecordsByFilter('categories', '', '-created', 1000, 0)
      for (let i = 0; i < cats.length; i++) {
        app.delete(cats[i])
      }
    } catch (e) {
      console.log('[migration 0017] Erro ao deletar categories:', e)
    }

    // 7. Apagar whatsapp_contacts
    try {
      const wcs = app.findRecordsByFilter('whatsapp_contacts', '', '-created', 1000, 0)
      for (let i = 0; i < wcs.length; i++) {
        app.delete(wcs[i])
      }
    } catch (e) {
      console.log('[migration 0017] Erro ao deletar whatsapp_contacts:', e)
    }

    // 8. Apagar todos os usuários (users)
    try {
      const us = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1000, 0)
      for (let i = 0; i < us.length; i++) {
        app.delete(us[i])
      }
    } catch (e) {
      console.log('[migration 0017] Erro ao deletar users:', e)
    }

    const cUsers = app.countRecords('_pb_users_auth_')
    const cCats = app.countRecords('categories')
    const cTxs = app.countRecords('transactions')
    const cBudgets = app.countRecords('budgets')
    const cAlerts = app.countRecords('alerts')
    const cJobs = app.countRecords('import_jobs')
    const cContacts = app.countRecords('whatsapp_contacts')
    const cStatus = app.countRecords('whatsapp_status')

    console.log(
      `[migration 0017] Limpeza concluída: users=${cUsers}, categories=${cCats}, transactions=${cTxs}, budgets=${cBudgets}, alerts=${cAlerts}, import_jobs=${cJobs}, whatsapp_contacts=${cContacts}, whatsapp_status=${cStatus}`,
    )
  },
  (app) => {
    // down migration: no-op
  },
)
