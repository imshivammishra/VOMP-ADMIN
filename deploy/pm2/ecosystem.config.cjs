// PM2 process map for the Contabo VPS.
// Usage: pm2 startOrReload deploy/pm2/ecosystem.config.cjs --env production
const base = process.env.VOMP_BASE || "/var/www/vomp";
const logs = `${base}/shared/logs`;

module.exports = {
  apps: [
    {
      name: "vomp-api",
      cwd: `${base}/workspace/apps/api`,
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: "8081",
        HOST: "127.0.0.1",
      },
      error_file: `${logs}/api-error.log`,
      out_file: `${logs}/api-out.log`,
      merge_logs: true,
      time: true,
    },
    {
      name: "vomp-admin",
      cwd: `${base}/workspace/apps/admin`,
      script: `${base}/workspace/node_modules/next/dist/bin/next`,
      args: "start -p 3002 -H 127.0.0.1",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "768M",
      env_production: {
        NODE_ENV: "production",
      },
      error_file: `${logs}/admin-error.log`,
      out_file: `${logs}/admin-out.log`,
      merge_logs: true,
      time: true,
    },
    {
      name: "vomp-web",
      cwd: `${base}/website`,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "768M",
      env_production: {
        NODE_ENV: "production",
      },
      error_file: `${logs}/web-error.log`,
      out_file: `${logs}/web-out.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
