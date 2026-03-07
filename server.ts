import express from "express";
import { RouterOSAPI } from "node-routeros";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  const DEVICES_FILE = path.resolve(__dirname, "devices.json");

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
