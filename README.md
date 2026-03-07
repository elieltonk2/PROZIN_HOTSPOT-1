# PROZIN_HOTSPOT 🚀
### Gerenciador de Vouchers Mikrotik Profissional

O **PROZIN_HOTSPOT** é uma ferramenta web moderna e responsiva desenvolvida para simplificar a gestão de usuários em redes Mikrotik Hotspot. Ideal para provedores, hotéis e comércios que buscam uma solução rápida, segura e personalizada.

---

## ✨ Funcionalidades Principais

- **Gerador de Vouchers em Massa:** Crie centenas de usuários de uma só vez com prefixos e comprimentos customizáveis.
- **Personalização Total:**
  - Envie a **sua logo** para o sistema e para as fichas de impressão.
  - Escolha entre templates de voucher padrão ou com imagem de fundo customizada.
  - Defina preços e cores para os vouchers.
- **Acesso Remoto via IPv6:** Desenvolvido especialmente para funcionar em conexões com CGNAT (como Starlink), permitindo gerenciamento de qualquer lugar do mundo.
- **Auto-Limpeza:** Script integrado para remover automaticamente usuários que atingiram o limite de tempo (uptime).
- **Dashboard em Tempo Real:** Visualize usuários ativos, consumo de dados e status da conexão.
- **Focado em Segurança:** Sem senhas nos vouchers (opcional) para facilitar o acesso do cliente final.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend:** Node.js, Express.
- **Integração:** `node-routeros` para comunicação direta com a API do Mikrotik.

---

## 🚀 Como Começar

### Pré-requisitos
- Node.js instalado.
- Mikrotik com a API habilitada (Porta 8728).

### Instalação
1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/prozin-hotspot.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente (opcional):
   ```bash
   cp .env.example .env
   ```
4. Inicie o servidor:
   ```bash
   npm run dev
   ```

---

## 💾 Armazenamento de Dados
O sistema armazena as configurações das MikroTiks localmente no arquivo `devices.json`. Este arquivo é criado automaticamente na primeira execução e **não deve ser enviado para o GitHub** (já incluído no `.gitignore`).

---

## ⚙️ Configuração no Mikrotik

Para que o sistema funcione remotamente, rode os seguintes comandos no Terminal do seu Mikrotik:

```bash
# Habilitar API
/ip service set api disabled=no port=8728

# Liberar Firewall (IPv6)
/ipv6 firewall filter add action=accept chain=input dst-port=8728 protocol=tcp comment="Permitir App Vouchers" place-before=0

# Liberar Firewall (IPv4 - se tiver IP público)
/ip firewall filter add action=accept chain=input dst-port=8728 protocol=tcp comment="Permitir App Vouchers" place-before=0
```

---

## 📄 Licença
Este projeto está sob a licença MIT.

---
*Desenvolvido com ❤️ para simplificar a gestão de redes.*
