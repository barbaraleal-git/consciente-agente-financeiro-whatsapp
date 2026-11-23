/* Garante que os logos oficiais existam em public/brand/, copiados BYTE A BYTE
 * dos originais aprovados pela dona em src/assets/. Apenas renomeia — zero
 * reprocessamento, zero redesenho, zero otimização.
 *
 * Idempotente: pula a cópia quando o destino já é byte-idêntico à fonte.
 * Falha alto (exit 1) se a fonte estiver ausente/vazia ou se a cópia divergir
 * — o logo nunca deve cair no fallback SVG silenciosamente.
 *
 * Uso manual: node scripts/ensure-brand-logos.mjs
 * Também roda automaticamente antes do `vite build` via o script "build" do
 * package.json (que é platform-managed: scripts.build = "node
 * scripts/build-with-logos.mjs"), então o app deployado sempre tem os
 * arquivos reais mesmo se public/brand/ se perder.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'

const pairs = [
  {
    src: 'src/assets/logooficialconsciente-7ccfd.jpg',
    dest: 'public/brand/Logo_Oficial_Consciente.jpg',
  },
  {
    src: 'src/assets/logooficialconscientecomnomeeslogan-9e384.jpg',
    dest: 'public/brand/Logo_Oficial_Consciente_com_Nome_e_Slogan.jpg',
  },
]

let failed = false

for (const { src, dest } of pairs) {
  const absSrc = path.resolve(process.cwd(), src)
  const absDest = path.resolve(process.cwd(), dest)

  if (!statSync(absSrc).isFile()) {
    console.error(`ERROR: fonte ausente: ${src}`)
    failed = true
    continue
  }
  const bytes = readFileSync(absSrc)
  if (bytes.length === 0) {
    console.error(`ERROR: fonte vazia: ${src}`)
    failed = true
    continue
  }

  let destBytes = Buffer.alloc(0)
  try {
    if (statSync(absDest).isFile()) destBytes = readFileSync(absDest)
  } catch {
    /* destino ainda inexistente — será escrito abaixo */
  }

  if (bytes.equals(destBytes)) {
    console.log(`ok (já igual): ${dest} (${bytes.length} bytes)`)
    continue
  }

  mkdirSync(path.dirname(absDest), { recursive: true })
  writeFileSync(absDest, bytes)
  const copy = readFileSync(absDest)
  const identical = bytes.equals(copy)
  console.log(`copiado: ${dest} (${bytes.length} bytes, byte-identico=${identical})`)
  if (!identical) failed = true
}

if (failed) {
  console.error('ERRO: copia dos logos oficiais divergiu — nao deixar passar')
  process.exit(1)
}
