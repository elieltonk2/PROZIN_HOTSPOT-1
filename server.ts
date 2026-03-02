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
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Mikrotik API Routes
  app.post("/api/mikrotik/connect", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    
    // Remove brackets if user added them, use raw IP
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
    
    // Clean host for socket connection
    const cleanHost = host.replace(/[\[\]]/g, '');
    const socket = new net.Socket();
    
    socket.setTimeout(15000); // Increase to 15 seconds for satellite

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
      res.status(500).json({ success: false, message: `Erro de conexão: ${err.message}` });
    });

    socket.connect({ port: parseInt(port), host: cleanHost, family: 6 });
  });

  app.post("/api/mikrotik/users", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 30 });

    try {
      await client.connect();
      const users = await client.write("/ip/hotspot/user/print");
      await client.close();
      res.json({ success: true, users });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/mikrotik/generate", async (req, res) => {
    let { 
      host, user, password, port = 8728, 
      count, profile, prefix = "", length = 6, 
      limitUptime = "0s", limitBytes = "0",
      voucherType = "username_only", // "username_only" or "user_pass"
      charType = "numbers" // "numbers", "letters", "mixed"
    } = req.body;
    
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
        const userPass = voucherType === "username_only" ? "" : username; // If user_pass, password = username

        const userParams: any = [
          "/ip/hotspot/user/add",
          `=name=${username}`,
          `=password=${userPass}`,
          `=profile=${profile || "default"}`,
          `=comment=Gerado por PROZIN_HOTSPOT`
        ];

        if (limitUptime !== "0s") userParams.push(`=limit-uptime=${limitUptime}`);
        if (limitBytes !== "0") userParams.push(`=limit-bytes-total=${limitBytes}`);

        await client.write(userParams);
        createdUsers.push(username);
      }
      
      await client.close();
      res.json({ success: true, createdUsers });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/mikrotik/setup-cleanup", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 30 });

    try {
      await client.connect();
      
      const scriptName = "prozin_cleanup";
      // Script to remove users who reached their uptime limit
      const scriptSource = "/ip hotspot user { :foreach i in=[find] do={ :local lu [get $i limit-uptime]; :local up [get $i uptime]; :if ($lu != 0s && $up >= $lu) do={ remove $i } } }";
      
      // Try to add script, if fails try to set (update)
      try {
        await client.write([
          "/system/script/add",
          `=name=${scriptName}`,
          `=source=${scriptSource}`
        ]);
      } catch (e) {
        await client.write([
          "/system/script/set",
          `=numbers=${scriptName}`,
          `=source=${scriptSource}`
        ]);
      }

      // Try to add scheduler, if fails try to set (update)
      const schedName = "prozin_sched";
      try {
        await client.write([
          "/system/scheduler/add",
          `=name=${schedName}`,
          "=interval=00:05:00",
          `=on-event=${scriptName}`
        ]);
      } catch (e) {
        await client.write([
          "/system/scheduler/set",
          `=numbers=${schedName}`,
          "=interval=00:05:00",
          `=on-event=${scriptName}`
        ]);
      }

      await client.close();
      res.json({ success: true, message: "Auto-limpeza configurada no Mikrotik (5 min)." });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/mikrotik/profiles", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 30 });

    try {
      await client.connect();
      const profiles = await client.write("/ip/hotspot/user/profile/print");
      await client.close();
      res.json({ success: true, profiles });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete("/api/mikrotik/users/:id", async (req, res) => {
    let { host, user, password, port = 8728 } = req.body;
    const cleanHost = host.replace(/[\[\]]/g, '');
    const { id } = req.params;
    const client = new RouterOSAPI({ host: cleanHost, user, password, port: parseInt(port), timeout: 30 });

    try {
      await client.connect();
      await client.write([
        "/ip/hotspot/user/remove",
        `=.id=${id}`
      ]);
      await client.close();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  const distPath = path.resolve(process.cwd(), "dist");
  const useVite = process.env.NODE_ENV !== "production" && !fs.existsSync(distPath);

  if (useVite) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
