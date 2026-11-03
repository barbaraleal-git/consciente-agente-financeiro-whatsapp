/// <reference path="../pb_data/types.d.ts" />

cronAdd('budget-check', '0 * * * *', () => {
  try {
    // Verificação de decodificação Base64 e validação de JPEG
    try {
      const sampleJpegB64 =
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
      const cleanB64 = sampleJpegB64.replace(/[\s\r\n]+/g, '')
      const b64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      const b64Lookup = {}
      for (let idx = 0; idx < b64Alphabet.length; idx++) {
        b64Lookup[b64Alphabet[idx]] = idx
      }
      b64Lookup['-'] = 62
      b64Lookup['_'] = 63

      let padCount = 0
      if (cleanB64.endsWith('==')) padCount = 2
      else if (cleanB64.endsWith('=')) padCount = 1

      const b64Len = cleanB64.length
      const outputLen = Math.floor((b64Len * 3) / 4) - padCount
      const decodedArray = new Uint8Array(outputLen)
      let outIdx = 0

      for (let i = 0; i < b64Len; i += 4) {
        const b0 = b64Lookup[cleanB64[i]]
        const b1 = i + 1 < b64Len ? b64Lookup[cleanB64[i + 1]] : undefined
        const b2 =
          i + 2 < b64Len && cleanB64[i + 2] !== '=' ? b64Lookup[cleanB64[i + 2]] : undefined
        const b3 =
          i + 3 < b64Len && cleanB64[i + 3] !== '=' ? b64Lookup[cleanB64[i + 3]] : undefined

        const triple =
          (b0 << 18) | (b1 << 12) | ((b2 !== undefined ? b2 : 0) << 6) | (b3 !== undefined ? b3 : 0)

        if (outIdx < outputLen) decodedArray[outIdx++] = (triple >> 16) & 255
        if (b2 !== undefined && outIdx < outputLen) decodedArray[outIdx++] = (triple >> 8) & 255
        if (b3 !== undefined && outIdx < outputLen) decodedArray[outIdx++] = triple & 255
      }

      const byte0 = decodedArray[0]
      const byte1 = decodedArray[1]
      const isJpeg = byte0 === 0xff && byte1 === 0xd8
      console.log(
        `[CRON_VERIFY_DECODER] Decoded ${outputLen} bytes. byte0=0x${(byte0 || 0).toString(16).toUpperCase()} byte1=0x${(byte1 || 0).toString(16).toUpperCase()} isJpegMagic=${isJpeg}`,
      )
    } catch (testErr) {
      console.log('[CRON_VERIFY_DECODER] Erro no teste:', testErr)
    }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Find all budgets for this month
    const budgets = $app.findRecordsByFilter('budgets', `month = '${currentMonth}'`, '', 500, 0)
    if (!budgets || budgets.length === 0) return

    const alertsCol = $app.findCollectionByNameOrId('alerts')

    for (const budget of budgets) {
      const ownerId = budget.getString('owner')
      const catId = budget.getString('category')
      const budgetAmount = budget.getInt('amount')
      if (budgetAmount <= 0) continue

      // Sum transactions for this category, month, and owner
      const txs = $app.findRecordsByFilter(
        'transactions',
        `owner = '${ownerId}' && category = '${catId}' && date >= '${currentMonth}-01' && date <= '${currentMonth}-31' && type = 'despesa'`,
        '',
        1000,
        0,
      )

      let spent = 0
      for (const t of txs) {
        spent += t.getInt('amount')
      }

      const ratio = spent / budgetAmount
      if (ratio >= 0.8) {
        let categoryName = 'Categoria'
        try {
          const catRec = $app.findRecordById('categories', catId)
          categoryName = catRec.getString('name')
        } catch (_) {}

        const percentage = Math.round(ratio * 100)
        const isExceeded = ratio >= 0.9
        const alertType = isExceeded ? 'budget' : 'warning'
        const title = isExceeded
          ? `Alerta Crítico: Caixinha de ${categoryName}`
          : `Aviso: Caixinha de ${categoryName} em ${percentage}%`
        const message = `Você já utilizou ${percentage}% da caixinha de ${categoryName} neste mês (R$ ${(spent / 100).toFixed(2)} de R$ ${(budgetAmount / 100).toFixed(2)}).`

        // Check if alert already exists today for this owner and title
        const todayStr = now.toISOString().slice(0, 10)
        const existingAlert = $app.findRecordsByFilter(
          'alerts',
          `owner = '${ownerId}' && title = '${title}' && created >= '${todayStr} 00:00:00'`,
          '',
          1,
          0,
        )

        if (existingAlert.length === 0) {
          const al = new Record(alertsCol)
          al.set('owner', ownerId)
          al.set('title', title)
          al.set('message', message)
          al.set('type', alertType)
          al.set('read', false)
          $app.save(al)
        }
      }
    }
  } catch (err) {
    console.log('Error in budget-check cron:', err)
  }
})
