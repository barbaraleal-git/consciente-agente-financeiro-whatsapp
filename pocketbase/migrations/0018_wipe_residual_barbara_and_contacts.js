/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Desvincular qualquer owner de whatsapp_status
    try {
      const wsRecords = app.findRecordsByFilter('whatsapp_status', '', '-created', 10, 0)
      for (let i = 0; i < wsRecords.length; i++) {
        const ws = wsRecords[i]
        if (ws.getString('owner')) {
          ws.set('owner', '')
          app.save(ws)
        }
      }
    } catch (e) {
      console.log('[migration 0018] Erro ao desvincular owner de whatsapp_status:', e)
    }

    // 2. Apagar todos os contatos do WhatsApp (evitar resquícios de nomes e números anteriores)
    try {
      const wcs = app.findRecordsByFilter('whatsapp_contacts', '', '-created', 1000, 0)
      for (let i = 0; i < wcs.length; i++) {
        app.delete(wcs[i])
      }
    } catch (e) {
      console.log('[migration 0018] Erro ao apagar whatsapp_contacts:', e)
    }

    // 3. Apagar todos os usuários humanos residuais (especialmente barbara.ferreira.leal@gmail.com recriada na 0016)
    // Mantemos apenas o usuário de serviço 'whatsapp-visitante@agente.internal' se existir, ou apagamos todos para zeragem absoluta
    try {
      const us = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 1000, 0)
      for (let i = 0; i < us.length; i++) {
        const u = us[i]
        // Se for a conta da Barbara ou qualquer usuário humano anterior, apaga
        if (u.getString('email') !== 'whatsapp-visitante@agente.internal') {
          app.delete(u)
        }
      }
    } catch (e) {
      console.log('[migration 0018] Erro ao apagar usuários:', e)
    }

    // 4. Apagar transações, categorias, orçamentos, alertas ou import_jobs residuais caso haja
    try {
      const txs = app.findRecordsByFilter('transactions', '', '-created', 1000, 0)
      for (let i = 0; i < txs.length; i++) {
        app.delete(txs[i])
      }
    } catch (_) {}

    try {
      const cats = app.findRecordsByFilter('categories', '', '-created', 1000, 0)
      for (let i = 0; i < cats.length; i++) {
        app.delete(cats[i])
      }
    } catch (_) {}

    try {
      const bgs = app.findRecordsByFilter('budgets', '', '-created', 1000, 0)
      for (let i = 0; i < bgs.length; i++) {
        app.delete(bgs[i])
      }
    } catch (_) {}

    try {
      const als = app.findRecordsByFilter('alerts', '', '-created', 1000, 0)
      for (let i = 0; i < als.length; i++) {
        app.delete(als[i])
      }
    } catch (_) {}

    try {
      const ijs = app.findRecordsByFilter('import_jobs', '', '-created', 1000, 0)
      for (let i = 0; i < ijs.length; i++) {
        app.delete(ijs[i])
      }
    } catch (_) {}

    const cUsers = app.countRecords('_pb_users_auth_')
    const cContacts = app.countRecords('whatsapp_contacts')
    console.log(
      `[migration 0018] Limpeza confirmada: users=${cUsers}, whatsapp_contacts=${cContacts}`,
    )
  },
  (app) => {
    // down: no-op
  },
)
