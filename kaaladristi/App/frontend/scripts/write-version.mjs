// Writes dist/version.json after `vite build` so a running tab can tell when a
// newer build is live (src/components/ui/BuildWatch.tsx) and reload itself.
// deploy.sh exports VITE_BUILD_SHA; a dev build writes "dev".
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const sha = process.env.VITE_BUILD_SHA || 'dev'
writeFileSync(path.join(dist, 'version.json'), JSON.stringify({ sha, builtAt: new Date().toISOString() }) + '\n')
console.log(`version.json → ${sha}`)
