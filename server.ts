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

  // Rota de Conexão com Diagnóstico
  app.post("/api/mikrotik/connect", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 15, keepalive: true });
    try {
      await client.connect();
      await client.close();
      res.json({ success: true, message: "Conectado com sucesso!" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Erro de login ou conexão." });
    }
  });

  // Gerador de Vouchers Profissional
  app.post("/api/mikrotik/generate", async (req, res) => {
    let { host, user, password, port = 8728, count, profile, prefix = "", length = 6, voucherType = "username_only" } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port) });
    try {
      await client.connect();
      const createdUsers = [];
      const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
      for (let i = 0; i < count; i++) {
        let randomPart = "";
        for (let j = 0; j < length; j++) randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        const username = prefix + randomPart;
        const pass = voucherType === "username_only" ? "" : username;
        await client.write(["/ip/hotspot/user/add", `=name=${username}`, `=password=${pass}`, `=profile=${profile || "default"}`, `=comment=Gerado por PROZIN_HOTSPOT`]);
        createdUsers.push(username);
      }
      await client.close();
      res.json({ success: true, createdUsers });
    } catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
  });

  // Automação IPv6 PPPoE
  app.post("/api/mikrotik/setup-ipv6-pppoe", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const client = new RouterOSAPI({ host: host.replace(/[\[\]]/g, ''), user, password, port: parseInt(port) });
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

  // Outras rotas (Profiles, Users, Delete, etc.)
  app.post("/api/mikrotik/profiles", async (req, res) => {
    const client = new RouterOSAPI({ host: req.body.host.replace(/[\[\]]/g, ''), user: req.body.user, password: req.body.password, port: parseInt(req.body.port) });
    try { await client.connect(); const profiles = await client.write("/ip/hotspot/user/profile/print"); await client.close(); res.json({ success: true, profiles }); }
    catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post("/api/mikrotik/users", async (req, res) => {
    const client = new RouterOSAPI({ host: req.body.host.replace(/[\[\]]/g, ''), user: req.body.user, password: req.body.password, port: parseInt(req.body.port) });
    try { await client.connect(); const users = await client.write("/ip/hotspot/user/print"); await client.close(); res.json({ success: true, users }); }
    catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
  });

  // Servir o Frontend
  const distPath = path.resolve(process.cwd(), "dist");
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }

  app.listen(Number(PORT), "0.0.0.0", () => console.log(`Servidor rodando na porta ${PORT}`));
}
startServer();
