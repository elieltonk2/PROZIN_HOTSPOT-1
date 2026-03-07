module.exports = {
  apps: [
    {
      name: "prozin-hotspot",
      script: "tsx",
      args: "server.ts",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      // Configurações de estabilidade
      max_memory_restart: "500M",
      exp_backoff_restart_delay: 100,
      // Logs para você consultar depois na VPS
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
