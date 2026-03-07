#!/bin/bash

echo "🚀 Iniciando Deploy Automático..."

# 1. Puxar as últimas alterações do GitHub
git pull origin main

# 2. Instalar dependências novas
npm install

# 3. Gerar o build do frontend
npm run build

# 4. Reiniciar o processo no PM2
if command -v pm2 &> /dev/null
then
    echo "🔄 Reiniciando com PM2..."
    # Tenta reiniciar, se não existir, inicia usando o arquivo de configuração
    pm2 restart prozin-hotspot || pm2 start ecosystem.config.cjs
else
    echo "⚠️ PM2 não encontrado. Tentando reiniciar manualmente..."
    nohup npm start > output.log 2>&1 &
    echo "✅ Tentativa de início em background finalizada. Verifique output.log"
fi

echo "✨ Deploy finalizado com sucesso!"
