# Running the Sabr server

This is how the shared server behind the app's **Sabr server** option is set up. It is
the same PocketBase setup as in [README.md](README.md), on its own instance and
hostname so it shares nothing with anything else on the machine.

The app expects it at `https://sabr-sync.danishali.dev` (`SABR_SERVER` in
`src/sync/engine.ts`). Change both together if the address changes.

## What it holds, and what it can't read

- Each account's email, and a bcrypt hash of a sign-in code. The code is made on the
  phone from the password (PBKDF2-SHA512, 200,000 rounds, salted with the email). The
  password itself is never sent.
- `vaults` records: an encrypted backup and an encrypted caregiver status per phone.
  The keys exist only on the phones (and in share codes people hand out themselves).
- PocketBase's own request logs (IP address, time, path). Turn these down, below.

So with full access to the machine, the database and the logs, you can see who has an
account and how big and how fresh their data is, but not what's in it. The weak spot is
a weak password: someone holding the database could try guesses offline, and each guess
costs 200,000 rounds plus bcrypt. The app asks for at least 10 characters.

## Set it up (about 15 minutes)

On the home server, in a new folder (say `~/sabr-sync`):

1. Copy `server/pb_migrations/` and `server/pb_hooks/` from this repo into the folder.
2. Create `docker-compose.yml`:

   ```yaml
   services:
     sabr-sync:
       # A community image; PocketBase does not publish an official one.
       # Pin a version tag once it's working, so updates happen when you choose.
       image: ghcr.io/muchobien/pocketbase:latest
       restart: unless-stopped
       ports:
         - "127.0.0.1:8091:8090"
       volumes:
         - ./pb_data:/pb_data
         - ./pb_migrations:/pb_migrations
         - ./pb_hooks:/pb_hooks
   ```

   (Port 8091 so it can sit next to another PocketBase on 8090.)
3. `docker compose up -d`, then `docker compose logs sabr-sync` and open the setup link
   it prints (change its port from 8090 to 8091) to make the admin account.
   The migration creates the `vaults` collection on first start.
4. Cloudflare Tunnel: in Zero Trust, Networks, Tunnels, open the existing tunnel on the
   home server, **Public hostname**, **Add**: subdomain `sabr-sync`, domain
   `danishali.dev`, service `http://localhost:8091`. Cloudflare adds the DNS record.
   (Use a one-level name like `sabr-sync.danishali.dev`: Cloudflare's free certificate
   doesn't cover deeper names like `sync.sabr.danishali.dev`.)
5. Keep the admin dashboard private: Zero Trust, Access, Applications, add a
   self-hosted app for `sabr-sync.danishali.dev/_/` that only lets your own email in.
   The app only uses `/api/`, so this doesn't affect anyone.
6. In the dashboard (`/_/`), Settings:
   - **Application**: turn on **Rate limiting** (the defaults are fine).
   - **Logs**: set **Max days retention** to 1 or 0, and turn off **IP logging**.
7. Check it from anywhere: `curl https://sabr-sync.danishali.dev/api/health` should say
   `"API is healthy."`.

Sign-ups stay open (anyone can make an account from the app). Each account can hold at
most 6 vaults (`pb_hooks/limits.pb.js`), and each vault is at most 20 MB.

## Keep it running

- **Back up `pb_data/`** (nightly copy elsewhere is plenty). It only holds encrypted
  data, so the copy is as safe to store as the server.
- **Update**: `docker compose pull && docker compose up -d`.
- **Someone asks to delete their account**: the app's "Sign out and delete server
  copies" removes their data. To remove the account too, delete the user in the
  dashboard; their vaults go with it.
