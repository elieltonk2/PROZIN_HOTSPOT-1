import express from "express";
import { RouterOSAPI } from "node-routeros";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import net from "net";
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  const DEVICES_FILE = path.resolve(__dirname, "devices.json");
  const CUSTOMERS_FILE = path.resolve(__dirname, "customers.json");
  const SETTINGS_FILE = path.resolve(__dirname, "settings.json");

  // Inicializar arquivos se não existirem
  if (!fs.existsSync(CUSTOMERS_FILE)) fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify([]));
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ pixKey: "", pixName: "PROZIN", pixCity: "SAO PAULO" }));

  // --- WHATSAPP SETUP ---
  let whatsappQr = "";
  let whatsappStatus = "loading";
  console.log('Iniciando WhatsApp...');

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }
  });

  client.on('qr', (qr) => {
    whatsappQr = qr;
    whatsappStatus = "qr_ready";
    console.log('WhatsApp QR Code gerado. Tamanho:', qr.length);
  });

  client.on('ready', () => {
    whatsappQr = "";
    whatsappStatus = "connected";
    console.log('WhatsApp pronto e conectado!');
  });

  client.on('disconnected', () => {
    whatsappStatus = "disconnected";
    console.log('WhatsApp desconectado.');
  });

  client.initialize().catch(err => {
    whatsappStatus = "error";
    console.error("Erro ao iniciar WhatsApp:", err);
  });

  // --- PIX HELPER ---
  function crc16(data: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  }

  function generatePixPayload(key: string, name: string, city: string, amount: number, description: string) {
    const amountStr = amount.toFixed(2);
    const merchantAccount = [
      "0014br.gov.bcb.pix",
      "01", key.length.toString().padStart(2, '0'), key
    ].join("");

    const additionalData = [
      "05", description.length.toString().padStart(2, '0'), description
    ].join("");

    const payload = [
      "000201",
      "26", merchantAccount.length.toString().padStart(2, '0'), merchantAccount,
      "52040000",
      "5303986",
      "54", amountStr.length.toString().padStart(2, '0'), amountStr,
      "5802BR",
      "59", name.length.toString().padStart(2, '0'), name,
      "60", city.length.toString().padStart(2, '0'), city,
      "62", additionalData.length.toString().padStart(2, '0'), additionalData,
      "6304"
    ].join("");

    return payload + crc16(payload);
  }

  // --- CRON JOBS ---
  cron.schedule('0 9 * * *', async () => {
    console.log("Iniciando rotina de cobrança e suspensão...");
    const customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    const devices = readDevices();
    if (devices.length === 0) return;
    const config = devices[0];
    
    const today = new Date();
    const currentDay = today.getDate();

    for (const customer of customers) {
      if (customer.dueDay === currentDay && whatsappStatus === "connected") {
        const pix = generatePixPayload(settings.pixKey, settings.pixName, settings.pixCity, customer.amount, "INTERNET");
        const message = `Olá ${customer.name}! 🚀\n\nSua fatura de internet vence hoje.\nValor: R$ ${customer.amount.toFixed(2)}\n\nChave PIX: ${settings.pixKey}\n\nCopie e cole o código abaixo:\n\n${pix}`;
        client.sendMessage(`${customer.phone}@c.us`, message);
        customer.lastBillingDate = today.toISOString().split('T')[0];
      }

      const dueDate = new Date();
      dueDate.setDate(customer.dueDay);
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 3 && customer.status !== "paid") {
        const mk = new RouterOSAPI({ host: config.host, user: config.user, password: config.password, port: parseInt(config.port) });
        try {
          await mk.connect();
          const users = await mk.write(["/ip/hotspot/user/print", `?name=${customer.mikrotikUser}`]);
          if (users.length > 0) {
            await mk.write(["/ip/hotspot/user/set", `=.id=${users[0]['.id']}`, "=disabled=yes"]);
            customer.status = "suspended";
            if (whatsappStatus === "connected") {
              client.sendMessage(`${customer.phone}@c.us`, `⚠️ Atenção ${customer.name}!\n\nSua internet foi suspensa por falta de pagamento. Para reativar, envie o comprovante.`);
            }
          }
          await mk.close();
        } catch (err) { console.error(`Erro ao suspender ${customer.name}:`, err); }
      }
    }
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
  });

  // Funções de persistência
  const readDevices = () => {
    if (!fs.existsSync(DEVICES_FILE)) return [];
    try {
      const data = fs.readFileSync(DEVICES_FILE, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  };

  const saveDevices = (devices: any[]) => {
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
  };

  // ==========================================
  // GERENCIAMENTO DE DISPOSITIVOS (MIKROTIKS)
  // ==========================================

  app.get("/api/devices", (req, res) => {
    res.json(readDevices());
  });

  app.post("/api/devices", (req, res) => {
    const { name, host, user, password, port = 8728 } = req.body;
    if (!name || !host || !user) {
      return res.status(400).json({ success: false, message: "Nome, Host e Usuário são obrigatórios." });
    }
    const devices = readDevices();
    const newDevice = { 
      id: Date.now().toString(), 
      name, 
      host: host.trim().replace(/[\[\]]/g, ''), 
      user, 
      password: password || '', 
      port: port.toString() 
    };
    devices.push(newDevice);
    saveDevices(devices);
    res.json({ success: true, device: newDevice });
  });

  app.delete("/api/devices/:id", (req, res) => {
    let devices = readDevices();
    devices = devices.filter((d: any) => d.id !== req.params.id);
    saveDevices(devices);
    res.json({ success: true });
  });

  // ==========================================
  // ROTAS FINANCEIRO E WHATSAPP
  // ==========================================

  app.get("/api/whatsapp/status", async (req, res) => {
    let qrImage = "";
    if (whatsappQr) qrImage = await qrcode.toDataURL(whatsappQr);
    res.json({ status: whatsappStatus, qr: qrImage });
  });

  app.get("/api/settings", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")));
  });

  app.post("/api/settings", (req, res) => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  });

  app.get("/api/customers", (req, res) => {
    res.json(JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8")));
  });

  app.post("/api/customers", (req, res) => {
    const customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
    const newCustomer = { ...req.body, id: Date.now().toString(), status: "pending" };
    customers.push(newCustomer);
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
    res.json(newCustomer);
  });

  app.delete("/api/customers/:id", (req, res) => {
    let customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
    customers = customers.filter((c: any) => c.id !== req.params.id);
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
    res.json({ success: true });
  });

  app.post("/api/customers/:id/pay", async (req, res) => {
    const customers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf8"));
    const customer = customers.find((c: any) => c.id === req.params.id);
    const devices = readDevices();
    if (customer && devices.length > 0) {
      const config = devices[0];
      customer.status = "paid";
      const mk = new RouterOSAPI({ host: config.host, user: config.user, password: config.password, port: parseInt(config.port) });
      try {
        await mk.connect();
        const users = await mk.write(["/ip/hotspot/user/print", `?name=${customer.mikrotikUser}`]);
        if (users.length > 0) {
          await mk.write(["/ip/hotspot/user/set", `=.id=${users[0]['.id']}`, "=disabled=no"]);
        }
        await mk.close();
        if (whatsappStatus === "connected") {
          client.sendMessage(`${customer.phone}@c.us`, `✅ Obrigado ${customer.name}!\n\nSeu pagamento foi confirmado e sua internet já está ativa.`);
        }
      } catch (err) { console.error("Erro ao reativar:", err); }
      fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Cliente ou RB não encontrada" });
    }
  });

  // ==========================================
  // ROTAS DA API MIKROTIK
  // ==========================================

  // Rota de Conexão e Diagnóstico
  app.post("/api/mikrotik/connect", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({
      host: cleanHost,
      user,
      password,
      port: parseInt(port),
      timeout: 15,
      keepalive: true
    });

    try {
      await client.connect();
      await client.close();
      res.json({ success: true, message: "Conectado com sucesso!" });
    } catch (error: any) {
      console.error(`[MIKROTIK CONNECT ERROR] ${cleanHost}:`, error);
      let customMessage = error.message || "Erro de conexão.";
      let hint = "";

      if (customMessage.includes("ECONNREFUSED")) {
        customMessage = "Conexão recusada pela MikroTik.";
        hint = " Verifique se o serviço API (porta " + port + ") está habilitado em 'IP > Services'.";
      } else if (customMessage.includes("ETIMEDOUT")) {
        customMessage = "Tempo de conexão esgotado.";
        hint = " Verifique se o IP/Host está correto e se o Firewall da MikroTik permite acesso externo na porta " + port + ".";
      } else if (customMessage.includes("EHOSTUNREACH")) {
        customMessage = "Host inalcançável.";
        hint = " O servidor não conseguiu encontrar o caminho até sua MikroTik. Verifique se ela está online e se o IP/DNS está correto.";
      } else if (customMessage.includes("invalid user name or password")) {
        customMessage = "Usuário ou senha inválidos.";
        hint = " Verifique as credenciais de acesso.";
      }

      res.status(500).json({ success: false, message: customMessage + hint });
    }
  });

  // Teste de Porta (Socket)
  app.post("/api/mikrotik/test-port", (req, res) => {
    let { host, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const socket = new net.Socket();
    socket.setTimeout(10000);

    socket.on("connect", () => {
      const remoteAddress = socket.remoteAddress;
      socket.destroy();
      console.log(`[PORT TEST] Sucesso ao conectar em ${cleanHost} (${remoteAddress}):${port}`);
      res.json({ success: true, message: "Porta aberta! Mikrotik visível." });
    });

    socket.on("timeout", () => {
      socket.destroy();
      res.status(408).json({ success: false, message: "Tempo esgotado." });
    });

    socket.on("error", (err) => {
      socket.destroy();
      console.error(`[PORT TEST] Falha ao conectar em ${cleanHost}:${port}:`, err.message);
      
      let hint = "";
      const isPrivate = cleanHost.startsWith('192.168.') || cleanHost.startsWith('10.') || cleanHost.startsWith('172.');
      if (isPrivate) {
        hint = " Você está usando um IP privado (local). O servidor na nuvem não consegue acessar sua rede local diretamente. Use o IP Público, DDNS (IP > Cloud) ou um Túnel VPN.";
      } else if (err.message.includes('ECONNREFUSED')) {
        hint = " O Mikrotik recusou a conexão. Verifique em 'IP > Services' se o serviço 'api' está habilitado e na porta " + port + ".";
      } else if (err.message.includes('ETIMEDOUT')) {
        hint = " A conexão expirou. Verifique se o Firewall do Mikrotik permite conexões na porta " + port + " vindas da internet (Chain Input).";
      } else if (err.message.includes('EHOSTUNREACH')) {
        hint = " O endereço IP ou Host não foi encontrado na internet. Verifique se digitou corretamente.";
      }

      res.status(500).json({ success: false, message: `Erro de conexão: ${err.message}.${hint}` });
    });

    socket.connect({ port: parseInt(port), host: cleanHost });
  });

  // Listar Usuários
  app.post("/api/mikrotik/users", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port), timeout: 20 });
    try {
      await client.connect();
      const users = await client.write("/ip/hotspot/user/print");
      await client.close();
      res.json({ success: true, users });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // Gerador de Vouchers
  app.post("/api/mikrotik/generate", async (req, res) => {
    let { host, user, password, port, count, profile, prefix, length, limitUptime, limitBytes, voucherType, charType } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port), timeout: 30 });
    try {
      await client.connect();
      const createdUsers = [];
      const chars = {
        numbers: "0123456789",
        letters: "ABCDEFGHJKLMNPQRSTUVWXYZ",
        mixed: "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
      };
      const selectedChars = chars[charType as keyof typeof chars] || chars.numbers;

      for (let i = 0; i < count; i++) {
        let randomPart = "";
        for (let j = 0; j < length; j++) randomPart += selectedChars.charAt(Math.floor(Math.random() * selectedChars.length));
        const username = prefix + randomPart;
        const pass = voucherType === "username_only" ? "" : username;
        const params: any = ["/ip/hotspot/user/add", `=name=${username}`, `=password=${pass}`, `=profile=${profile}`, `=comment=Gerado por PROZIN` ];
        if (limitUptime && limitUptime !== "0s") params.push(`=limit-uptime=${limitUptime}`);
        if (limitBytes && limitBytes !== "0") params.push(`=limit-bytes-total=${limitBytes}`);
        await client.write(params);
        createdUsers.push(username);
      }
      await client.close();
      res.json({ success: true, createdUsers });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // Configurar IPv6 PPPoE e Bridge
  app.post("/api/mikrotik/setup-ipv6-pppoe", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port), timeout: 30 });
    try {
      await client.connect();
      const poolName = "pool-ipv6";
      
      // 1. Configurar DHCPv6 Client na ether1 (WAN) para receber o prefixo /56
      // Tentamos encontrar se já existe, se não, adicionamos
      const dhcpClients = await client.write("/ipv6/dhcp-client/print");
      const existingClient = (dhcpClients as any[]).find(c => c.interface === 'ether1');
      
      if (!existingClient) {
        await client.write([
          "/ipv6/dhcp-client/add", 
          "=interface=ether1", 
          "=request=prefix", 
          `=pool-name=${poolName}`, 
          "=pool-prefix-length=64", 
          "=add-default-route=yes",
          "=use-peer-dns=yes"
        ]);
      } else {
        await client.write([
          "/ipv6/dhcp-client/set", 
          `=.id=${existingClient['.id']}`, 
          `=pool-name=${poolName}`, 
          "=pool-prefix-length=64"
        ]);
      }

      // 2. Configurar Endereço IPv6 na Bridge (LAN) usando o pool
      const addresses = await client.write("/ipv6/address/print");
      const bridgeAddr = (addresses as any[]).find(a => a.interface === 'bridge1_REDELOCAL' || a.interface === 'bridge');
      const targetInterface = bridgeAddr ? bridgeAddr.interface : 'bridge1_REDELOCAL';

      if (!bridgeAddr) {
        await client.write([
          "/ipv6/address/add",
          `=interface=${targetInterface}`,
          `=from-pool=${poolName}`,
          "=advertise=yes"
        ]).catch(() => {});
      }

      // 3. Configurar ND (Neighbor Discovery) na Bridge
      await client.write([
        "/ipv6/nd/set",
        "=.id=[find default=yes]",
        "=managed-address-configuration=yes",
        "=other-configuration=yes"
      ]);

      // 4. Configurar Perfil PPP para entregar IPv6 aos clientes
      // Setamos no perfil 'default' e tentamos no 'default-encryption' também
      const pppProfiles = ['default', 'default-encryption'];
      for (const profileName of pppProfiles) {
        await client.write([
          "/ppp/profile/set",
          `=.id=[find name=${profileName}]`,
          `=dhcpv6-pd-pool=${poolName}`,
          `=remote-ipv6-prefix-pool=${poolName}`
        ]).catch(() => {});
      }

      await client.close();
      res.json({ success: true, message: "IPv6 configurado para Bridge e PPPoE (Pool: " + poolName + ")" });
    } catch (error: any) { 
      if (client) await client.close().catch(() => {});
      res.status(500).json({ success: false, message: error.message }); 
    }
  });

  // Listar Perfis
  app.post("/api/mikrotik/profiles", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port), timeout: 20 });
    try {
      await client.connect();
      const profiles = await client.write("/ip/hotspot/user/profile/print");
      await client.close();
      res.json({ success: true, profiles });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // Excluir Usuário
  app.delete("/api/mikrotik/users/:id", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port), timeout: 20 });
    try {
      await client.connect();
      await client.write(["/ip/hotspot/user/remove", `=.id=${req.params.id}`]);
      await client.close();
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // Utilitários
  app.get("/api/utils/my-ip", (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip });
  });

  // ==========================================
  // CONFIGURAÇÃO DE SERVIDOR (VITE / STATIC)
  // ==========================================

  const distPath = path.resolve(__dirname, "dist");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(distPath);

  if (!isProduction) {
    console.log("[DEBUG] Iniciando em modo DESENVOLVIMENTO (Vite)...");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, allowedHosts: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      app.use("*", async (req, res, next) => {
        const url = req.originalUrl;
        try {
          let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) { vite.ssrFixStacktrace(e as Error); next(e); }
      });
    } catch (e) {
      console.error("Erro ao carregar o Vite. Certifique-se de que as devDependencies estão instaladas ou que você está em modo produção.");
    }
  } else {
    console.log("[DEBUG] Iniciando em modo PRODUÇÃO (Static)...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (fs.existsSync(path.resolve(distPath, "index.html"))) {
        res.sendFile(path.resolve(distPath, "index.html"));
      } else {
        res.status(500).send("Pasta 'dist' não encontrada. Execute 'npm run build' antes de iniciar.");
      }
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

startServer().catch(err => console.error("FALHA AO INICIAR:", err));
