/// <reference path="../pb_data/types.d.ts" />

// ----------------------------------------------------
// ROUTES TEMPORÁRIAS DE RESTAURAÇÃO (arquivo temporário)
// Servem o conteúdo íntegro do commit a954a6e do
// whatsapp_bridge.js em fatias base64, para remontagem
// no ambiente do builder. REMOVER após a restauração.
// ----------------------------------------------------

// GET /backend/v1/restore/info — metadados do arquivo remoto
routerAdd('GET', '/backend/v1/restore/info', (e) => {
  try {
    const RESTORE_URL =
      'https://raw.githubusercontent.com/barbaraleal-git/consciente-agente-financeiro-whatsapp/a954a6e/pocketbase/hooks/whatsapp_bridge.js'
    const res = $http.send({ url: RESTORE_URL, method: 'GET' })
    const rawText = typeof res.body === 'string' ? res.body : String(res.body || '')
    let size = rawText.length
    try {
      const rawBytes = Array.isArray(res.raw) ? res.raw : []
      if (rawBytes.length > 0) size = rawBytes.length
    } catch (_) {}
    const text = rawText
    let lineCount = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') lineCount++
    }
    // JSVM: base64Encode não existe — codificar manualmente em chunks
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const chunkB64 = function (str) {
      let out = ''
      for (let i = 0; i < str.length; i += 3) {
        const b0 = str.charCodeAt(i)
        const b1 = i + 1 < str.length ? str.charCodeAt(i + 1) : 0
        const b2 = i + 2 < str.length ? str.charCodeAt(i + 2) : 0
        out += charset[b0 >> 2]
        out += charset[((b0 & 3) << 4) | (b1 >> 4)]
        out += i + 1 < str.length ? charset[((b1 & 15) << 2) | (b2 >> 6)] : '='
        out += i + 2 < str.length ? charset[b2 & 63] : '='
      }
      return out
    }
    // UTF-8 safe: usar raw bytes se disponível (evita charCode > 255)
    // Conteúdo do arquivo é todo ASCII (código JS), então charCode direto é seguro.
    const b64 = chunkB64(text)
    const SLICE = 60000
    const slices = Math.ceil(b64.length / SLICE)
    return e.json(200, {
      ok: true,
      statusCode: res.statusCode,
      size: bytes.length,
      lines: lineCount,
      textLength: text.length,
      b64Length: b64.length,
      sliceSize: SLICE,
      slices,
    })
  } catch (err) {
    return e.json(200, { ok: false, error: String(err) })
  }
})

// GET /backend/v1/restore/slice/{n} — fatia n (0-based) do base64
routerAdd('GET', '/backend/v1/restore/slice/{n}', (e) => {
  try {
    const RESTORE_URL =
      'https://raw.githubusercontent.com/barbaraleal-git/consciente-agente-financeiro-whatsapp/a954a6e/pocketbase/hooks/whatsapp_bridge.js'
    const n = parseInt(e.request.pathValue('n') || '0', 10)
    const res = $http.send({ url: RESTORE_URL, method: 'GET' })
    const text = typeof res.body === 'string' ? res.body : String(res.body || '')
    if (!text) {
      return e.json(200, { ok: false, error: 'res.body vazio', statusCode: res.statusCode })
    }
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const chunkB64 = function (str) {
      let out = ''
      for (let i = 0; i < str.length; i += 3) {
        const b0 = str.charCodeAt(i)
        const b1 = i + 1 < str.length ? str.charCodeAt(i + 1) : 0
        const b2 = i + 2 < str.length ? str.charCodeAt(i + 2) : 0
        out += charset[b0 >> 2]
        out += charset[((b0 & 3) << 4) | (b1 >> 4)]
        out += i + 1 < str.length ? charset[((b1 & 15) << 2) | (b2 >> 6)] : '='
        out += i + 2 < str.length ? charset[b2 & 63] : '='
      }
      return out
    }
    const b64 = chunkB64(text)
    const SLICE = 60000
    const total = Math.ceil(b64.length / SLICE)
    if (n < 0 || n >= total) {
      return e.json(200, { ok: false, error: 'slice fora do intervalo', total })
    }
    const chunk = b64.slice(n * SLICE, (n + 1) * SLICE)
    return e.json(200, {
      ok: true,
      slice: n,
      total,
      len: chunk.length,
      data: chunk,
    })
  } catch (err) {
    return e.json(200, { ok: false, error: String(err) })
  }
})
