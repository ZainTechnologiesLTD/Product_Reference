# Production Runbook

This app should run behind Caddy on one fixed port. Do not run `pnpm dev` on the
production server.

## Build and Start

```powershell
cd C:\Application\Product_Reference
pnpm run build
pm2 start dist\index.js --name product-reference --cwd C:\Application\Product_Reference --update-env
pm2 save
```

The app listens on `PORT`, defaulting to `3000`. In production it now fails fast
if that port is busy, because Caddy must proxy to one predictable port.

## Caddy

The repository `Caddyfile` proxies to `localhost:3000`.

For browser-trusted HTTPS, use a real domain name in the Caddyfile:

```caddyfile
app.example.com {
	reverse_proxy localhost:3000
	encode zstd gzip
}
```

Caddy/Let's Encrypt cannot issue a public trusted certificate for a private LAN
IP such as `192.168.1.201`. If users browse by IP, use one of these options:

- Use plain HTTP on the LAN to avoid certificate warnings:

```caddyfile
http://192.168.1.201 {
	reverse_proxy localhost:3000
	encode zstd gzip
}
```

- Or use Caddy internal/local certificates and install Caddy's root CA on every
client device. Without trusting that local CA, browsers will keep warning.

## Windows Auto-Start

PM2 is supervising the Node process while the user is logged in, but plain
`pm2 startup` does not work on this Windows host. Use Windows services for
restart-after-power-failure.

Recommended service layout:

1. Install Caddy as a Windows service:

```powershell
C:\Caddy\caddy.exe service install --config C:\Application\Product_Reference\Caddyfile
Start-Service caddy
Set-Service caddy -StartupType Automatic
```

2. Install the Node app as a Windows service using a service wrapper such as NSSM
or WinSW. Service command should be:

```text
Application: C:\Program Files\nodejs\node.exe
Arguments:   C:\Application\Product_Reference\dist\index.js
Directory:   C:\Application\Product_Reference
Environment: NODE_ENV=production, PORT=3000, DATABASE_URL=...
Startup:     Automatic
```

After setup, reboot-test the server and verify:

```powershell
Get-Service caddy
Invoke-WebRequest http://localhost:3000/api/health
Invoke-WebRequest http://localhost:3000/
```
