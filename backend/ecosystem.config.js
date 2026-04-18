module.exports = {
  apps: [
    {
      name: "finance-tracker-api",
      script: "dist/index.js",
      cwd: "/var/www/finance-tracker-api",
      instances: 1,
      exec_mode: "fork",

      // Restart policy
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: "10s",

      // Logging
      error_file: "/var/log/finance-tracker-api/error.log",
      out_file: "/var/log/finance-tracker-api/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Environment
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },

      // Load .env from deployment directory
      env_file: "/var/www/finance-tracker-api/.env",
    },
  ],
};
