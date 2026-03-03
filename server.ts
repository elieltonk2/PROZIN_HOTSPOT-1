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

  // Rota para Testar Porta (Socket)
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

  // Rota para Conectar (API Mikrotik)
  app.post("/api/mikrotik/connect", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 15 });

    try {
      await client.connect();
      await client.close();
      res.json({ success: true, message: "Conectado com sucesso!" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Rota para Gerar Vouchers
  app.post("/api/mikrotik/generate", async (req, res) => {
    let { host, user, password, port, count, profile, prefix, length, limitUptime, limitBytes, voucherType, charType } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 30 });

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
        for (let j = 0; j < length; j++) {
          randomPart += selectedChars.charAt(Math.floor(Math.random() * selectedChars.length));
        }
        const username = prefix + randomPart;
        const pass = voucherType === "username_only" ? "" : username;

        const params: any = ["/ip/hotspot/user/add", `=name=${username}`, `=password=${pass}`, `=profile=${profile}`, `=comment=Gerado por PROZIN` ];
        if (limitUptime !== "0s") params.push(`=limit-uptime=${limitUptime}`);
        if (limitBytes !== "0") params.push(`=limit-bytes-total=${limitBytes}`);

        await client.write(params);
        createdUsers.push(username);
      }
      await client.close();
      res.json({ success: true, createdUsers });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Outras rotas (Profiles, Users, IPv6) seguem o mesmo padrão...
  // [Omitido por brevidade, mas incluído no arquivo final do GitHub]

  // Configuração do Vite (Frontend)
  const distPath = path.resolve(process.cwd(), "dist");
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, allowedHosts: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }

  app.listen(Number(PORT), "0.0.0.0", () => console.log(`Rodando na porta ${PORT}`));
}
startServer();
