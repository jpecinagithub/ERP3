import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      'web-1a21wjckug61.up-de-fra1-k8s-1.apps.run-on-seenode.com',
      '.apps.run-on-seenode.com'
    ]
  }
})
