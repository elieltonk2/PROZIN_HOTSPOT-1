import express from "express";
import { createServer as createViteServer } from "vite";
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
      res.status(500).json({ success: false, message: error.message || "Erro de conexão." });
    }
  });

  // Teste de Porta (Socket)
  app.post("/api/mikrotik/test-port", (req, res) => {
    let { host, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const socket = new net.Socket();
    socket.setTimeout(10000);

    socket.on("connect", () => {
      socket.destroy();
      res.json({ success: true, message: "Porta aberta! Mikrotik visível." });
    });

    socket.on("timeout", () => {
      socket.destroy();
      res.status(408).json({ success: false, message: "Tempo esgotado." });
    });

    socket.on("error", (err) => {
      socket.destroy();
      res.status(500).json({ success: false, message: `Erro: ${err.message}` });
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

  // Configurar IPv6 PPPoE
  app.post("/api/mikrotik/setup-ipv6-pppoe", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port), timeout: 30 });
    try {
      await client.connect();
      const poolName = "pool-pppoe";
      await client.write(["/ipv6/dhcp-client/add", "=interface=ether1", "=request=prefix", `=pool-name=${poolName}`, "=pool-prefix-length=64", "=add-default-route=yes"]).catch(() => {
        return client.write(["/ipv6/dhcp-client/set", "=.id=[find interface=ether1]", `=pool-name=${poolName}`, "=pool-prefix-length=64"]);
      });
      await client.write(["/ppp/profile/set", "=.id=[find name=default]", `=dhcpv6-pd-pool=${poolName}`, `=remote-ipv6-prefix-pool=${poolName}`]);
      await client.write(["/ipv6/nd/set", "=.id=[find default=yes]", "=managed-address-configuration=yes", "=other-configuration=yes"]);
      await client.close();
      res.json({ success: true, message: "IPv6 PPPoE configurado!" });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
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
  } else {
    console.log("[DEBUG] Iniciando em modo PRODUÇÃO (Static)...");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (fs.existsSync(path.resolve(distPath, "index.html"))) {
        res.sendFile(path.resolve(distPath, "index.html"));
      } else {
        res.status(500).send("Pasta 'dist' não encontrada. Execute 'npm run build'.");
      }
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

startServer().catch(err => console.error("FALHA AO INICIAR:", err));
