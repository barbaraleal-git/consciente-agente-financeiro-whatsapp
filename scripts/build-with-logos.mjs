/* Wrapper de build: garante os logos oficiais em public/brand/ e depois
 * chama o vite build com todos os argumentos originais preservados.
 * O package.json é gerenciado pela plataforma (versão bumpada a cada commit,
 * scripts protegidos), então este wrapper é invocado a partir de scripts
 * que a dona pode apontar. Uso: node scripts/build-with-logos.mjs [--mode dev]
 */
import { spawnSync } from 'node:child_process'

const ensure = spawnSync('node', ['scripts/ensure-brand-logos.mjs'], {
  stdio: 'inherit',
})
if (ensure.status !== 0) {
  process.exit(ensure.status ?? 1)
}

const result = spawnSync('npx', ['vite', 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
