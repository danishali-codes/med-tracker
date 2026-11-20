# Sync server (optional)

Sabr works fully offline and never sends anything anywhere by default. This
folder is only for people who want one or both of these:

- **An encrypted backup** of their medicines, history and notes, to restore on a new phone.
- **Caregiver sharing**, so a family member can see whether today's doses were taken.

Both use a [PocketBase](https://pocketbase.io) server: the Sabr server that Sabr's
developer runs for anyone (pick "Sabr server" in the app, nothing to set up), or one
that you run yourself with the steps below. How the Sabr server itself is run is in
[SABR-SERVER.md](SABR-SERVER.md).

## What the server can see

Everything is encrypted on the phone before it is sent (XSalsa20-Poly1305, NaCl
secretbox). The server stores:

| Stored | Readable by the server? |
| --- | --- |
| Your account email and a hashed sign-in code | The email, yes. The code is made from your password on the phone; the password itself is never sent, and the code can't be turned back into it |
| Your backup | No. Locked with a random key; that key is locked again with a second code made from your password, which never leaves the phone. Your recovery key opens it too |
| Your shared status | No. Locked with a key that only exists in the share code you hand out |
| When each was last updated, and its size | Yes |

Medicine names are not in the shared status at all unless you turn on "Include
medicine names". Photos of pills are never sent.

## Run it

You need a machine that is always on (a small VPS, a home server, a Raspberry Pi)
and HTTPS in front of it.

1. Download PocketBase 0.23 or newer for your machine from
   https://github.com/pocketbase/pocketbase/releases and unzip it into a folder.
2. Copy `pb_migrations/` and `pb_hooks/` from this folder next to the `pocketbase` binary.
3. Start it:

   ```sh
   ./pocketbase serve --http 127.0.0.1:8090
   ```

   On first start it applies the migration (creating the `vaults` collection) and
   prints a link to create your admin account.
4. Put HTTPS in front of it. Any of these work:
   - **Caddy**: `caddy reverse-proxy --from pb.example.com --to 127.0.0.1:8090`
   - **Cloudflare Tunnel**: `cloudflared tunnel --url http://127.0.0.1:8090`, then
     route a hostname to it in the Cloudflare dashboard.
   - **nginx** with a Let's Encrypt certificate.

### With Docker

```yaml
# docker-compose.yml
services:
  pocketbase:
    # A community image; PocketBase does not publish an official one.
    image: ghcr.io/muchobien/pocketbase:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:8090:8090"
    volumes:
      - ./pb_data:/pb_data
      - ./pb_migrations:/pb_migrations
      - ./pb_hooks:/pb_hooks
```

## Who can sign up

PocketBase lets anyone create an account by default. If the server is just for you
and your family:

1. Create the accounts you need from the app (Settings, Sync and sharing, Create
   account) or from the admin dashboard.
2. In the dashboard, open **users**, then **API Rules**, and set **Create rule** to
   superusers only (clear it and lock it).

Caregivers don't need an account. The share code is enough to read one person's
encrypted status.

## In the app

1. Settings, **Sync and sharing**, turn on **Back up and share online**, then pick
   **My own server**.
2. Enter the server address (for example `pb.example.com`), your email and a password.
3. Turn on what you want:
   - **Keep an encrypted backup**. On a new phone, sign in with the same email and
     password to restore it. Also tap **Show recovery key** and save it somewhere safe:
     it opens the backup if you lose the password. Without either, nobody can open it.
   - **Let someone see my doses**, then **Get share code** and send it to them. They
     paste it in Settings, **People I look after**. **Stop old codes working** makes a
     new code and cuts off everyone using the old one.

Turning sync off signs you out, stops all sharing, and can delete the server copies.
**Fully local** (Settings, Privacy) pauses all of it without signing out.

Accounts made before Sabr 0.10 signed in with the plain password. They still work on
your own server; their backups open with the recovery key only.
