# Putz-Duell im Heimnetz

Die App läuft als kleiner Webserver auf dem Rechner, auf dem auch evcc läuft. Beide Handys öffnen sie im Browser über die Adresse dieses Rechners und sehen denselben Spielstand live. Der Stand liegt in `data/state.json`.

Es gibt keine Abhängigkeiten: nur Node.js (ab Version 18) oder Docker.

## Schnellster Weg: ein Befehl

```bash
git clone -b claude/cleaning-schedule-app-points-x25osi https://github.com/Snice-Eduki/snice-links.git
sudo bash snice-links/putz-duell/install.sh
```

`install.sh` erkennt selbst, ob Docker vorhanden ist (dann Container), sonst richtet es einen systemd-Dienst mit Node.js ein und installiert Node.js bei Bedarf nach. Am Ende zeigt es die Adresse für die Handys an. Die beiden Varianten darunter sind derselbe Weg von Hand.

## Variante A: Docker (empfohlen, wenn evcc schon in Docker läuft)

```bash
git clone -b claude/cleaning-schedule-app-points-x25osi https://github.com/Snice-Eduki/snice-links.git snice-links && cd snice-links/putz-duell
docker compose up -d --build
```

Fertig. Die App läuft auf Port **8470**. Der Spielstand liegt im Ordner `./data` neben der `docker-compose.yml` und bleibt bei Updates erhalten.

Update später: `git pull && docker compose up -d --build`

## Variante B: Direkt mit Node.js (ohne Docker)

```bash
sudo apt install nodejs            # falls noch nicht da; "node --version" muss 18 oder höher zeigen
sudo git clone -b claude/cleaning-schedule-app-points-x25osi https://github.com/Snice-Eduki/snice-links.git /opt/snice-links && sudo ln -s /opt/snice-links/putz-duell /opt/putz-duell
sudo useradd -r -s /usr/sbin/nologin putzduell
sudo chown -R putzduell:putzduell /opt/putz-duell
sudo cp /opt/putz-duell/putz-duell.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now putz-duell
```

Status prüfen: `systemctl status putz-duell`, Log: `journalctl -u putz-duell -f`.

Falls `node` nicht unter `/usr/bin/node` liegt (`which node`), den Pfad in `putz-duell.service` bei `ExecStart` anpassen.

## Auf den Handys öffnen

1. IP-Adresse des Rechners herausfinden: `hostname -I` auf dem Rechner, oder im Router nachsehen. evcc läuft dort meist unter `http://<IP>:7070`; Putz-Duell dann unter `http://<IP>:8470`.
2. Diese Adresse im Handy-Browser öffnen (im selben WLAN).
3. Als App auf den Startbildschirm legen:
   - **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“.
   - **Android (Chrome):** Menü (⋮) → „Zum Startbildschirm hinzufügen“ bzw. „App installieren“.
4. Beim ersten Öffnen fragt die App „Wer bist du?“. Jeder wählt sich selbst; das Handy merkt sich die Antwort.

Damit die IP sich nicht ändert, dem Rechner im Router eine feste IP (DHCP-Reservierung) geben. Wer von unterwegs abhaken will, braucht einen VPN-Zugang ins Heimnetz (z. B. WireGuard oder Tailscale). Die App hat keine Anmeldung, also nicht direkt ins Internet freigeben.

## Einstellungen

| Variable   | Standard        | Bedeutung                          |
|------------|-----------------|------------------------------------|
| `PORT`     | `8470`          | Port des Webservers                |
| `DATA_DIR` | `./data`        | Ordner für `state.json`            |

Ein anderer Port in Docker: in `docker-compose.yml` die linke Zahl bei `ports` ändern, z. B. `"8080:8470"`.

## Spielstand zurücksetzen oder sichern

Der komplette Stand ist die Datei `data/state.json`. Zum Sichern kopieren, zum Zurücksetzen den Dienst stoppen, die Datei löschen und den Dienst wieder starten.
