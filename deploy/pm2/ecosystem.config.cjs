// PM2 process map for the Contabo VPS.
//
// Current production layout:
//   /opt/vomp-deploy/main-website    -> public Next.js site   (3100, public)
//   /opt/vomp-deploy/admin-backend   -> API + admin monorepo  (3101 private, 3102 admin)
//   /opt/vomp-deploy/shared          -> env, SQLite DB, uploads, logs, backups
//
// Start or update all three services:
//   pm2 startOrReload deploy/pm2/ecosystem.config.cjs --env production
//
// The environment variables below only set process wiring. Application secrets
// live in /opt/vomp-deploy/shared/env/*.env and are loaded by dotenv/Next.
const base = process.env.VOMP_BASE || "/opt/vomp-deploy";
const workspace = process.env.VOMP_WORKSPACE || `${base}/admin-backend`;
const website = process.env.VOMP_WEBSITE || `${base}/main-website`;
const shared = process.env.VOMP_SHARED || `${base}/shared`;
const logs = `${shared}/logs`;

module.exports = {
  apps: [
    {
      name: "VOMP-API",
      cwd: `${workspace}/apps/api`,
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 2000,
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: "3101",
        HOST: "127.0.0.1",
      },
      error_file: `${logs}/VOMP-API-error.log`,
      out_file: `${logs}/VOMP-API-out.log`,
      merge_logs: true,
      time: true,
    },
    {
      name: "VOMP-ADMIN",
      cwd: `${workspace}/apps/admin`,
      script: `${workspace}/node_modules/next/dist/bin/next`,
      args: "start -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "768M",
      restart_delay: 2000,
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: "3102",
      },
      error_file: `${logs}/VOMP-ADMIN-error.log`,
      out_file: `${logs}/VOMP-ADMIN-out.log`,
      merge_logs: true,
      time: true,
    },
    {
      name: "VOMP-MAIN",
      cwd: website,
      script: `${website}/node_modules/next/dist/bin/next`,
      args: "start -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "768M",
      restart_delay: 2000,
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: "3100",
      },
      error_file: `${logs}/VOMP-MAIN-error.log`,
      out_file: `${logs}/VOMP-MAIN-out.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
