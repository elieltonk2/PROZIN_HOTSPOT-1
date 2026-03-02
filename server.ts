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

  // Rota de Conexão
  app.post("/api/mikrotik/connect", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const isIPv6 = cleanHost.includes(':');
    const client = new RouterOSAPI({
      host: cleanHost, user, password, port: parseInt(port),
      timeout: 30, keepalive: true, family: isIPv6 ? 6 : 4
    });
    try {
      await client.connect();
      await client.close();
      res.json({ success: true, message: "Conectado!" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Rota de Teste de Porta
  app.post("/api/mikrotik/test-port", (req, res) => {
    let { host, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const isIPv6 = cleanHost.includes(':');
    const socket = new net.Socket();
    socket.setTimeout(10000);
    socket.on("connect", () => { socket.destroy(); res.json({ success: true, message: "Porta aberta!" }); });
    socket.on("timeout", () => { socket.destroy(); res.status(408).json({ success: false, message: "Timeout" }); });
    socket.on("error", (err) => { socket.destroy(); res.status(500).json({ success: false, message: err.message }); });
    socket.connect({ port: parseInt(port), host: cleanHost, family: isIPv6 ? 6 : 4 });
  });

  // Rota de Usuários
  app.post("/api/mikrotik/users", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port) });
    try {
      await client.connect();
      const users = await client.write("/ip/hotspot/user/print");
      await client.close();
      res.json({ success: true, users });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // Rota de Perfis
  app.post("/api/mikrotik/profiles", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port) });
    try {
      await client.connect();
      const profiles = await client.write("/ip/hotspot/user/profile/print");
      await client.close();
      res.json({ success: true, profiles });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // Rota para Gerar Vouchers
  app.post("/api/mikrotik/generate", async (req, res) => {
    let { host, user, password, port, count, profile, prefix, length, limitUptime, limitBytes, charType } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port) });
    try {
      await client.connect();
      const createdUsers = [];
      const chars = { numbers: "0123456789", letters: "ABCDEFGHJKLMNPQRSTUVWXYZ", mixed: "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" };
      const selectedChars = chars[charType as keyof typeof chars] || chars.numbers;
      for (let i = 0; i < count; i++) {
        let randomPart = "";
        for (let j = 0; j < length; j++) randomPart += selectedChars.charAt(Math.floor(Math.random() * selectedChars.length));
        const username = prefix + randomPart;
        const userParams: any = ["/ip/hotspot/user/add", `=name=${username}`, `=password=`, `=profile=${profile}`, `=comment=Gerado por PROZIN` ];
        if (limitUptime && limitUptime !== "0s") userParams.push(`=limit-uptime=${limitUptime}`);
        if (limitBytes && limitBytes !== "0") userParams.push(`=limit-bytes-total=${limitBytes}`);
        await client.write(userParams);
        createdUsers.push(username);
      }
      await client.close();
      res.json({ success: true, createdUsers });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  app.get("/api/utils/my-ip", (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip });
  });

  // Configuração do Vite/Estáticos
  const distPath = path.resolve(process.cwd(), "dist");
  const useVite = process.env.NODE_ENV !== "production" || !fs.existsSync(distPath);

  if (useVite) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) { next(e); }
    });
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

startServer();
