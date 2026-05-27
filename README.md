# barorder

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-hygm4ays)

## Kör lokalt

```bash
npm install
npm run dev
```

Appen använder Supabase om `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` finns i `.env`.
Om de saknas startar appen i lokalt demoläge med data i webbläsarens `localStorage`.

Demo-PIN:

- `0000` = Admin
- `1234` = Barpersonal
- `6789` = Lager

## Installera på telefon/padda

Appen är förberedd som PWA med manifest, appikon och service worker.
När den hostas via HTTPS kan den läggas till på hemskärmen:

- iPhone/iPad: öppna sidan i Safari, dela, välj Lägg till på hemskärmen.
- Android: öppna sidan i Chrome, välj Installera app eller Lägg till på startskärmen.

Notiser i appen fungerar när användaren har gett tillstånd och appen tar emot nya ärenden.
För notiser när appen är helt stängd behövs en separat push-backend som skickar Web Push till service workern.
