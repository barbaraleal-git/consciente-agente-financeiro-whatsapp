/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
  try {
    const job = e.record
    const ownerId = job.getString('owner')
    const rawContent = job.getString('raw_content')

    if (!rawContent || !rawContent.trim()) {
      job.set('status', 'done')
      job.set('total_lines', 0)
      job.set('imported_count', 0)
      $app.save(job)
      return
    }

    job.set('status', 'processing')
    $app.save(job)

    const lines = rawContent.split('\n')
    const totalLines = lines.length
    job.set('total_lines', totalLines)

    // Get categories for owner
    const categories = $app.findRecordsByFilter(
      'categories',
      `owner = '${ownerId}'`,
      'created',
      100,
      0,
    )

    let defaultCategory = categories.find((c) => c.getString('name').toLowerCase() === 'outros')
    if (!defaultCategory && categories.length > 0) {
      defaultCategory = categories[0]
    }

    const categoryKeywords = {
      alimentação: [
        'almoço',
        'jantar',
        'lanche',
        'mercado',
        'supermercado',
        'padaria',
        'comida',
        'pizza',
        'hambúrguer',
        'ifood',
        'café',
        'restaurante',
      ],
      transporte: [
        'uber',
        '99',
        'gasolina',
        'combustível',
        'estacionamento',
        'pedágio',
        'ônibus',
        'metrô',
        'posto',
      ],
      moradia: ['aluguel', 'condomínio', 'luz', 'água', 'energia', 'internet', 'gás', 'iptu'],
      saúde: ['farmácia', 'remédio', 'médico', 'consulta', 'exame', 'hospital', 'dentista'],
      lazer: ['cinema', 'show', 'festa', 'viagem', 'jogo', 'passeio', 'bar', 'cerveja'],
      educação: ['curso', 'livro', 'faculdade', 'escola', 'mensalidade'],
      salário: ['salário', 'pagamento', 'adiantamento', 'pix recebido', 'recebido', 'venda'],
      investimentos: ['investimento', 'aporte', 'cdb', 'selic', 'ações', 'poupança'],
    }

    const transactionsCol = $app.findCollectionByNameOrId('transactions')
    let importedCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      let msgText = line
      let dateStr = new Date().toISOString().slice(0, 10)

      const dateMatch = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
      if (dateMatch) {
        let day = dateMatch[1].padStart(2, '0')
        let month = dateMatch[2].padStart(2, '0')
        let year = dateMatch[3]
        if (year.length === 2) year = '20' + year
        dateStr = `${year}-${month}-${day}`
      }

      const contentMatch = line.match(/(?:- |\] )[^:]+:\s*(.+)$/)
      if (contentMatch) {
        msgText = contentMatch[1].trim()
      }

      const amountMatch = msgText.match(
        /(?:R\$\s*|valor:?\s*|paguei\s*)?(\d{1,6}(?:[,\.]\d{1,2})?)\s*(?:reais|conto)?/i,
      )

      if (amountMatch) {
        let numStr = amountMatch[1].replace(',', '.')
        let floatVal = parseFloat(numStr)

        if (!isNaN(floatVal) && floatVal > 0 && floatVal < 1000000) {
          let matchedCat = defaultCategory
          let txType = 'despesa'
          const lowerText = msgText.toLowerCase()

          for (const cat of categories) {
            const catName = cat.getString('name').toLowerCase()
            const keywords = categoryKeywords[catName] || [catName]
            if (keywords.some((kw) => lowerText.includes(kw))) {
              matchedCat = cat
              txType = cat.getString('type')
              break
            }
          }

          let cleanDesc = msgText
            .replace(/R\$\s*\d+([,\.]\d+)?/gi, '')
            .replace(/\b\d+([,\.]\d+)?\s*(reais)?\b/gi, '')
            .replace(/[,\.\-\:]+/g, ' ')
            .trim()

          if (!cleanDesc || cleanDesc.length < 2) {
            cleanDesc = matchedCat
              ? `Gasto em ${matchedCat.getString('name')}`
              : 'Gasto importado do WhatsApp'
          }

          const amountCents = Math.round(floatVal * 100)

          const tx = new Record(transactionsCol)
          tx.set('owner', ownerId)
          tx.set('description', cleanDesc.slice(0, 100))
          tx.set('amount', amountCents)
          tx.set('date', dateStr)
          tx.set('category', matchedCat ? matchedCat.id : '')
          tx.set('type', txType)
          tx.set('source', 'import')
          tx.set('note', `Origem: Histórico do WhatsApp ("${line.slice(0, 80)}")`)
          $app.save(tx)
          importedCount++
        }
      }
    }

    job.set('status', 'done')
    job.set('imported_count', importedCount)
    $app.save(job)
  } catch (err) {
    try {
      e.record.set('status', 'failed')
      e.record.set('error', String(err))
      $app.save(e.record)
    } catch (_) {}
  } finally {
    e.next()
  }
}, 'import_jobs')
