module.exports = {
  apps: [
    {
      name: "daolab-bot",
      script: "bot.mjs",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
      error_file: "./data/logs/err.log",
      out_file: "./data/logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
