import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['ra6zgr-ip-220-133-81-12.tunnelmole.net', 'anchor-stage.owlpay.com', 'sarhdm-ip-220-133-81-12.tunnelmole.net']
  }
})
