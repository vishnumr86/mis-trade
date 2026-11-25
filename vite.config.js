import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { createApi } from './server/api.mjs'

// Serve the API from the Vite dev/preview server so `npm run dev` is a single process.
const misApi = () => {
  const api = createApi({ dataDir: path.resolve('data') })
  const mw = async (req, res, next) => ((await api(req, res)) ? undefined : next())
  return {
    name: 'mis-api',
    configureServer(s) { s.middlewares.use(mw) },
    configurePreviewServer(s) { s.middlewares.use(mw) },
  }
}

export default defineConfig({ plugins: [react(), misApi()] })
