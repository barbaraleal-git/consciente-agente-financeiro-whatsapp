import React from 'react'

interface MarkdownRendererProps {
  content: string
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (!line.trim()) {
      i++
      continue
    }

    // Code block ```
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // consume closing ```
      elements.push(
        <pre
          key={`code-${i}`}
          className="p-3 my-3 bg-slate-900 text-slate-100 rounded-xl text-xs overflow-x-auto font-mono border border-slate-800"
        >
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Table detection: line has | and next line has |-
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      lines[i + 1].includes('|') &&
      lines[i + 1].includes('-')
    ) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(renderTable(tableLines, `table-${i}`))
      continue
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-2xl sm:text-3xl font-bold text-slate-900 mt-6 mb-3 tracking-tight border-b border-slate-200 pb-2"
        >
          {renderInline(line.replace(/^#\s+/, ''))}
        </h1>,
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-xl sm:text-2xl font-bold text-slate-900 mt-6 mb-2.5 tracking-tight border-b border-slate-100 pb-1.5"
        >
          {renderInline(line.replace(/^##\s+/, ''))}
        </h2>,
      )
      i++
      continue
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base sm:text-lg font-bold text-slate-800 mt-4 mb-1.5">
          {renderInline(line.replace(/^###\s+/, ''))}
        </h3>,
      )
      i++
      continue
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-sm sm:text-base font-semibold text-slate-800 mt-3 mb-1">
          {renderInline(line.replace(/^####\s+/, ''))}
        </h4>,
      )
      i++
      continue
    }

    // Horizontal rule ---
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${i}`} className="my-6 border-slate-200" />)
      i++
      continue
    }

    // Unordered list items (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: { text: string; indent: number }[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const match = lines[i].match(/^(\s*)[-*]\s+(.*)$/)
        if (match) {
          listItems.push({ indent: match[1].length, text: match[2] })
        }
        i++
      }
      elements.push(
        <ul
          key={`ul-${i}`}
          className="my-2.5 space-y-1.5 list-disc list-outside pl-5 text-sm text-slate-700"
        >
          {listItems.map((item, idx) => (
            <li key={idx} className={item.indent > 0 ? 'ml-4' : ''}>
              {renderInline(item.text)}
            </li>
          ))}
        </ul>,
      )
      continue
    }

    // Numbered list items (1. 2. etc)
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*\d+\.\s+/, '')
        listItems.push(itemText)
        i++
      }
      elements.push(
        <ol
          key={`ol-${i}`}
          className="my-2.5 space-y-1.5 list-decimal list-outside pl-5 text-sm text-slate-700"
        >
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-3 pl-4 border-l-4 border-indigo-500 bg-indigo-50/50 p-2.5 rounded-r-lg text-sm text-slate-700 italic"
        >
          {quoteLines.map((ql, qidx) => (
            <p key={qidx}>{renderInline(ql)}</p>
          ))}
        </blockquote>,
      )
      continue
    }

    // Paragraph
    elements.push(
      <p key={`p-${i}`} className="my-2 text-sm leading-relaxed text-slate-700">
        {renderInline(line)}
      </p>,
    )
    i++
  }

  return <div className="space-y-1 text-slate-800">{elements}</div>
}

function renderTable(tableLines: string[], key: string): React.ReactNode {
  if (tableLines.length < 2) return null
  const headerCells = parseTableRow(tableLines[0])
  const bodyRows = tableLines.slice(2).map((row) => parseTableRow(row))

  return (
    <div key={key} className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
          <tr>
            {headerCells.map((cell, idx) => (
              <th key={idx} className="p-2.5 border-r border-slate-200 last:border-r-0">
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className="p-2.5 border-r border-slate-100 last:border-r-0 text-slate-700"
                >
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
}

function renderInline(text: string): React.ReactNode {
  // Regex para tags simples: inline code `...`, bold **...**, italic *...*, link [text](url)
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    // Inline code `...`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/)
    // Bold **...**
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/)
    // Link [...](...)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/)

    // Verifica qual token ocorre primeiro
    const codeIndex = codeMatch ? codeMatch[1].length : -1
    const boldIndex = boldMatch ? boldMatch[1].length : -1
    const linkIndex = linkMatch ? linkMatch[1].length : -1

    const indices = [
      { type: 'code', index: codeIndex, match: codeMatch },
      { type: 'bold', index: boldIndex, match: boldMatch },
      { type: 'link', index: linkIndex, match: linkMatch },
    ].filter((item) => item.index >= 0)

    if (indices.length === 0) {
      parts.push(remaining)
      break
    }

    // Pega o que começa antes
    indices.sort((a, b) => a.index - b.index)
    const first = indices[0]

    if (first.type === 'code' && first.match) {
      if (first.match[1]) parts.push(first.match[1])
      parts.push(
        <code
          key={`code-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 text-indigo-700 font-mono text-[11px] border border-slate-200"
        >
          {first.match[2]}
        </code>,
      )
      remaining = first.match[3]
    } else if (first.type === 'bold' && first.match) {
      if (first.match[1]) parts.push(first.match[1])
      parts.push(
        <strong key={`bold-${keyIdx++}`} className="font-semibold text-slate-900">
          {first.match[2]}
        </strong>,
      )
      remaining = first.match[3]
    } else if (first.type === 'link' && first.match) {
      if (first.match[1]) parts.push(first.match[1])
      parts.push(
        <a
          key={`link-${keyIdx++}`}
          href={first.match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 underline font-medium"
        >
          {first.match[2]}
        </a>,
      )
      remaining = first.match[4]
    }
  }

  return parts
}
