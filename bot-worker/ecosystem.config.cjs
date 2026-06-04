// PM2 ecosystem config for the bot-worker manager
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'bot-manager',
      script: './dist/manager.js',
      // PM2 will restart the process forever — our own backoff logic handles spacing.
      // This covers cases where the whole process crashes (not just individual workers).
      restart_delay: 10000,   // wait 10s before restarting the manager itself
      max_restarts: 999,      // effectively never give up
      min_uptime: '5s',       // if it dies faster than this, count as a crash
      watch: false,
      // Merge stdout + stderr into one log stream in PM2
      merge_logs: true,
      // Rotate logs automatically (requires pm2-logrotate module)
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
