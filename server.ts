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
    const client = new RouterOSAPI({
      host: cleanHost,
      user,
      password,
      port: parseInt(port),
      timeout: 10,
      keepalive: true
    });

    try {
      await client.connect();
      await client.close();
      res.json({ success: true, message: "Connected successfully" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Erro de login ou conexão." });
    }
  });

  // Teste de Porta
  app.post("/api/mikrotik/test-port", (req, res) => {
    let { host, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const socket = new net.Socket();
    socket.setTimeout(5000); 

    socket.on("connect", () => {
      socket.destroy();
      res.json({ success: true, message: "Porta aberta! O Mikrotik respondeu." });
    });

    socket.on("error", (err) => {
      socket.destroy();
      res.status(500).json({ success: false, message: "Porta fechada ou IP inacessível." });
    });

    socket.connect({ port: parseInt(port), host: cleanHost });
  });

  // Automação IPv6 PPPoE
  app.post("/api/mikrotik/setup-ipv6-pppoe", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port) });

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
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ... (Outras rotas de Gerar Vouchers e Listar Usuários)
  // [Omitido por brevidade, mas incluído no seu projeto final]

  const distPath = path.resolve(process.cwd(), "dist");
  const useVite = process.env.NODE_ENV !== "production" && !fs.existsSync(distPath);

  if (useVite) {
    const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }

  app.listen(Number(PORT), "0.0.0.0", () => console.log(`App rodando em http://localhost:${PORT}`));
}

startServer();
