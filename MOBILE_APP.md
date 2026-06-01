# Mobilapp med Capacitor

Projektet kan nu köras som:

- webbapp via Vite/server
- iPhone-app via `ios/`
- Android-app via `android/`

Samma React-kod används för alla tre varianter.

## Vanliga kommandon

```bash
npm run build
npm run mobile:sync
npm run mobile:open:ios
npm run mobile:open:android
```

`npm run mobile:build` bygger webbappen och synkar den till både iOS och Android.

## Det Codex kan göra i koden

- bygga vidare på webbappen
- synka nya webbändringar till iOS/Android
- justera appnamn, app-id, färger, ikoner och splash screen
- lägga till native-funktioner via Capacitor-plugins
- förbereda native push-notiser i appen
- hjälpa till med release-checklistor och build-fel

## Det du behöver göra personligen

- ha ett Apple Developer-konto för App Store
- ha ett Google Play Developer-konto för Play Butik
- öppna iOS-projektet i Xcode och välja ditt Apple-team för signering
- öppna Android-projektet i Android Studio och skapa release-signering
- ta fram slutlig appikon, skärmbilder, appbeskrivning och supportuppgifter
- skapa push-certifikat/nycklar för Apple/Google om native push-notiser ska användas
- godkänna och skicka in appen i App Store Connect och Google Play Console

## Viktigt om push-notiser

Webbappens PWA-notiser finns kvar för webben. För en riktig app i App Store och Play Butik bör vi lägga till native push-notiser separat, eftersom iOS och Android hanterar låsskärm, ljud och bakgrundsläge via sina egna system.
