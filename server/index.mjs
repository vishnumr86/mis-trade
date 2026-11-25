// Production server: serves the built app (dist/) and the API. Run `npm run build` first.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from './api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const api = createApi({ dataDir: path.join(root, 'data') })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' }
const port = process.env.PORT || 4173

http.createServer(async (req, res) => {
  if (await api(req, res)) return
  const p = path.join(dist, path.normalize(new URL(req.url, 'http://x').pathname))
  const file = p.startsWith(dist) && fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dist, 'index.html')
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
}).listen(port, () => console.log(`MIS dashboard on http://localhost:${port}`))
