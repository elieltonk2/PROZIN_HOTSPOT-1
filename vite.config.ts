import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Carrega as variáveis de ambiente (como a GEMINI_API_KEY)
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Expõe a chave da API para o frontend de forma segura
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        // Atalho para importar arquivos usando '@/'
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0', // Necessário para o Railway e Docker
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true, // Permite que o site abra em qualquer domínio (como .up.railway.app)
    },
  };
});
