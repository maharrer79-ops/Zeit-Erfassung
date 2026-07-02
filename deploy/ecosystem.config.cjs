// ZeitWerk – pm2 Konfiguration (Alternative zu systemd)
// Nutzung auf dem VPS (im Projektordner):
//   npm install -g pm2
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save && pm2 startup      # Autostart nach Reboot einrichten
//   pm2 logs zeitwerk            # Logs ansehen
//
// WICHTIG: JWT_SECRET durch einen eigenen Zufallswert ersetzen:
//   openssl rand -hex 32

module.exports = {
  apps: [
    {
      name: 'zeitwerk',
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        JWT_SECRET: 'BITTE-AENDERN-openssl-rand-hex-32',
        DB_PATH: './data.sqlite',
      },
    },
  ],
};
