```bash
# Get the code
git clone --depth 1 https://github.com/supabase/supabase

# Make your new supabase project directory
mkdir supabase-project

# Tree should look like this
# .
# ├── supabase
# └── supabase-project

# Copy the compose files over to your project
cp -rf supabase/docker/* supabase-project

# Copy the fake env vars
cp supabase/docker/.env.example supabase-project/.env

# Switch to your project directory
cd supabase-project

# Pull the latest images
docker compose pull
sh utils/generate-keys.sh
sh utils/add-new-auth-keys.sh
```

```bash
for f in supabase/migrations/*.sql; do
  echo "Applying $f..."
  docker exec -i supabase-db psql -U postgres -d postgres < "$f"
done
```

## Låsta pushnotiser

Web Push kräver VAPID-nycklar. Skapa ett nyckelpar:

```bash
npx web-push generate-vapid-keys
```

Lägg den publika nyckeln i webbappens miljö:

```bash
VITE_VAPID_PUBLIC_KEY=DIN_PUBLIC_KEY
```

Lägg dessa som secrets/miljövariabler för Supabase Edge Function:

```bash
VAPID_SUBJECT=mailto:din-epost@exempel.se
VAPID_PUBLIC_KEY=DIN_PUBLIC_KEY
VAPID_PRIVATE_KEY=DIN_PRIVATE_KEY
```

Deploya funktionen:

```bash
supabase functions deploy notify-request
supabase secrets set VAPID_SUBJECT=mailto:din-epost@exempel.se VAPID_PUBLIC_KEY=DIN_PUBLIC_KEY VAPID_PRIVATE_KEY=DIN_PRIVATE_KEY
```

På iPhone/iPad måste sidan först installeras på hemskärmen. Öppna sedan appen från ikonen och tryck på notisknappen (`Off`) i Lagerdashboard eller Tillkalla personal så telefonen registrerar sig för låsta pushnotiser.
