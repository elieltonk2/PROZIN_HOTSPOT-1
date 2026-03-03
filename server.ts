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

  // Mikrotik API Routes
  app.post("/api/mikrotik/connect", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({
      host: cleanHost,
      user,
      password,
      port: parseInt(port),
      timeout: 30,
      keepalive: true
    });

    try {
      await client.connect();
      await client.close();
      res.json({ success: true, message: "Connected successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/mikrotik/test-port", (req, res) => {
    let { host, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const socket = new net.Socket();
    socket.setTimeout(15000); 

    socket.on("connect", () => {
      socket.destroy();
      res.json({ success: true, message: "Porta aberta! O Mikrotik está visível na nuvem." });
    });

    socket.on("timeout", () => {
      socket.destroy();
      res.status(408).json({ success: false, message: "Tempo esgotado. A porta parece estar fechada ou o IP é inválido." });
    });

    socket.on("error", (err) => {
      socket.destroy();
      let msg = `Erro: ${err.message}`;
      if (err.message.includes('ENETUNREACH')) msg = "Servidor sem IPv6. Use DNS Cloud.";
      if (err.message.includes('ECONNREFUSED')) msg = "Conexão Recusada. A API está ligada no Mikrotik?";
      if (err.message.includes('ETIMEDOUT')) msg = "Tempo Esgotado. O túnel/PC está ligado?";
      res.status(500).json({ success: false, message: msg });
    });

    socket.connect({ port: parseInt(port), host: cleanHost });
  });

  // Rota para automação do IPv6 PPPoE
  app.post("/api/mikrotik/setup-ipv6-pppoe", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 30 });

    try {
      await client.connect();
      const poolName = "pool-pppoe";
      
      await client.write([
        "/ipv6/dhcp-client/add",
        "=interface=ether1",
        "=request=prefix",
        `=pool-name=${poolName}`,
        "=pool-prefix-length=64",
        "=add-default-route=yes"
      ]).catch(() => {
        return client.write([
          "/ipv6/dhcp-client/set",
          "=.id=[find interface=ether1]",
          `=pool-name=${poolName}`,
          "=pool-prefix-length=64"
        ]);
      });

      await client.write([
        "/ppp/profile/set",
        "=.id=[find name=default]",
        `=dhcpv6-pd-pool=${poolName}`,
        `=remote-ipv6-prefix-pool=${poolName}`
      ]);

      await client.write([
        "/ipv6/nd/set",
        "=.id=[find default=yes]",
        "=managed-address-configuration=yes",
        "=other-configuration=yes"
      ]);

      await client.close();
      res.json({ success: true, message: "IPv6 PPPoE configurado com sucesso!" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ... (Outras rotas permanecem iguais)
  // ... (ip/hotspot/user/print, generate, setup-cleanup, etc)

  const distPath = path.resolve(process.cwd(), "dist");
  const useVite = process.env.NODE_ENV !== "production" && !fs.existsSync(distPath);

  if (useVite) {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true, // Correção para o Railway aqui também
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    // ... (restante do middleware vite)
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
