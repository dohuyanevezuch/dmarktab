// scripts/copy-manifest.js
import { copyFileSync } from 'fs'

try {
  copyFileSync('public/manifest.json', 'dist/manifest.json')
  console.log('✅ manifest.json copied to dist/')
} catch (err) {
  console.error('❌ Error copying manifest.json:', err)
  process.exit(1)
}