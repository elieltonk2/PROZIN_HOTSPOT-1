// server.ts (Trecho da rota de conexão atualizado)
app.post("/api/mikrotik/connect", async (req, res) => {
  let { host, user, password, port = 8728 } = req.body;
  const cleanHost = host.replace(/[\[\]]/g, '');
  
  const client = new RouterOSAPI({
    host: cleanHost,
    user,
    password,
    port: parseInt(port),
    timeout: 30, // Tempo maior para conexões via satélite
    keepalive: true
  });

  try {
    await client.connect();
    await client.close();
    res.json({ success: true, message: "Connected successfully" });
  } catch (error: any) {
    // Agora o erro é mais detalhado
    let msg = error.message;
    if (msg.includes("invalid user name or password")) msg = "Usuário ou Senha incorretos no Mikrotik.";
    if (msg.includes("cannot connect")) msg = "O Mikrotik recusou a conexão. Verifique se a API está ligada.";
    
    res.status(500).json({ 
      success: false, 
      message: msg || "Erro desconhecido. Verifique as permissões (api) do grupo do usuário no Mikrotik." 
    });
  }
});
