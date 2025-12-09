# Deployment mit Caddy

## Setup

### 1. Spotify Developer Dashboard

Gehe zu [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) und füge die Redirect URI hinzu:
```
https://spotify.lenny.tf/callback
```

### 2. Environment Variables

Die `.env` Datei ist bereits konfiguriert für:
- **PUBLIC_URL**: `https://spotify.lenny.tf`
- **SPOTIFY_REDIRECT_URI**: `https://spotify.lenny.tf/callback`
- **PORT**: `1027` (intern)

### 3. Docker Container starten

```bash
# Container bauen und starten
docker-compose up -d --build

# Logs prüfen
docker-compose logs -f lyrica

# Container sollte auf Port 1027 lauschen
```

### 4. Caddy konfigurieren

#### Option A: Caddy direkt auf dem Host

```bash
# Caddyfile nach /etc/caddy kopieren (oder in dein Caddy-Config-Verzeichnis)
sudo cp Caddyfile /etc/caddy/sites/spotify.lenny.tf

# Caddy neu laden
sudo systemctl reload caddy
```

#### Option B: Include in bestehendem Caddyfile

Füge in deine Haupt-Caddy-Config hinzu:
```caddy
import /path/to/Lyrica/Caddyfile
```

### 5. DNS Setup

Stelle sicher, dass `spotify.lenny.tf` auf deinen Server zeigt:
```bash
# DNS A-Record prüfen
dig spotify.lenny.tf

# Sollte auf deine Server-IP zeigen
```

## Testen

1. Öffne: `https://spotify.lenny.tf`
2. Klicke auf "Connect Spotify"
3. Autorisiere die App
4. Spiele einen Song auf Spotify ab
5. Lyrics sollten angezeigt werden

## Troubleshooting

### Container läuft nicht
```bash
docker-compose ps
docker-compose logs lyrica
```

### Caddy erreicht Container nicht
```bash
# Prüfe ob Container läuft und Port 1027 offen ist
docker ps | grep lyrica
netstat -tlnp | grep 1027

# Teste direkt vom Host
curl http://localhost:1027/api
```

### SSL-Probleme
```bash
# Caddy Logs prüfen
sudo journalctl -u caddy -f

# Manuell SSL-Zertifikat erneuern
sudo caddy reload --config /etc/caddy/Caddyfile
```

### Spotify Redirect funktioniert nicht
- Prüfe ob Redirect URI exakt `https://spotify.lenny.tf/callback` ist
- Keine trailing slashes
- HTTPS, nicht HTTP

## Produktions-Checklist

- [x] DNS A-Record für `spotify.lenny.tf` gesetzt
- [x] Spotify Redirect URI aktualisiert
- [x] `.env` mit `PUBLIC_URL` konfiguriert
- [x] Docker Container läuft
- [x] Caddy Reverse Proxy konfiguriert
- [x] HTTPS funktioniert (Caddy macht Auto-SSL)
- [ ] Logs-Monitoring eingerichtet
- [ ] Backup-Strategie definiert

## Monitoring

```bash
# Container Status
docker-compose ps

# Live Logs
docker-compose logs -f

# Container Resource Usage
docker stats lyrica
```
