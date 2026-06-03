# RosettaStone

App Android personnelle pour construire son dictionnaire d'apprentissage de langues — mots, transcriptions, traductions, verbes & conjugaisons, notes de grammaire. **100 % local, aucun compte, aucun serveur.**

Toutes les données sont stockées sur le téléphone via IndexedDB ; la sauvegarde se fait en exportant un JSON depuis l'écran Réglages.

## Stack

- React 19 + TypeScript + Vite (SPA)
- TanStack Router (file-based) + TanStack Query
- shadcn/ui + Tailwind v4 + vaul (Drawer)
- IndexedDB via `idb`
- Capacitor 6 (wrap Android natif)

## Workflow dev

```bash
# Lancer en dev (web, pour itérer rapidement)
npm run dev                 # http://localhost:8080

# Build web + sync vers le projet Android
npm run cap:sync

# Lancer sur émulateur / téléphone branché en USB
npm run android:run

# Construire un APK debug (sortie dans android/app/build/outputs/apk/debug/)
npm run android:apk
```

## Installer l'APK debug sur ton téléphone

1. Brancher le téléphone en USB et activer le débogage USB.
2. `npm run android:apk`
3. `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

## Structure

```
src/
├── main.tsx                 # Entrée SPA
├── routes/                  # Pages (file-based router)
│   ├── __root.tsx           # Shell mobile + BottomNav
│   ├── index.tsx            # Accueil / stats
│   ├── languages.tsx        # CRUD langues
│   ├── dictionary.tsx       # CRUD mots
│   ├── verbs.tsx            # CRUD verbes + conjugaisons
│   ├── notes.tsx            # CRUD notes
│   └── settings.tsx         # Export / import / reset
├── components/
│   ├── mobile/              # Shell mobile : BottomNav, Header, FAB, LanguagePicker
│   └── ui/                  # shadcn/ui
└── lib/
    ├── db.ts                # Schéma IndexedDB + helpers CRUD
    └── utils.ts             # cn()
```
