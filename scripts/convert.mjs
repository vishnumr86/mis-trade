// Usage: node scripts/convert.mjs [workbook.xlsx] [outDir]
// Writes one JSON file per financial year: <outDir>/mis-2025-2026.json, ...
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { parseWorkbook, splitByYear } from '../src/lib/parseMis.js'

const [src = 'MIS.xlsx', outDir = 'data'] = process.argv.slice(2)
const parsed = parseWorkbook(XLSX.read(fs.readFileSync(src), { type: 'buffer' }), path.basename(src))
fs.mkdirSync(outDir, { recursive: true })
for (const doc of splitByYear(parsed)) {
  const file = path.join(outDir, `mis-${doc.fy}.json`)
  fs.writeFileSync(file, JSON.stringify(doc, null, 1))
  console.log(`Wrote ${file}: ${doc.monthly.length} months, ${doc.daily.length} days`)
}
parsed.meta.warnings.forEach((w) => console.warn('WARN', w))
