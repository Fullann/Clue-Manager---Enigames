# Clue-Manager---Enigames

Application web pour la gestion d'indices d'escape game (front React + API Express).

## Prerequis

- Node.js 20+
- MySQL 8+ (ou MariaDB compatible)

## Installation locale

1. Installer les dependances:

```bash
npm install
```

2. Copier le fichier d'environnement:

```bash
cp .env.example .env
```

3. Renseigner les variables MySQL dans `.env`.

4. Lancer en developpement:

```bash
npm run dev
```

## Test local avec Docker

1. Lancer l'application + MySQL en mode production:

```bash
docker compose up --build -d
```

2. Ouvrir l'application:

- http://localhost:3000

3. Arreter les conteneurs:

```bash
docker compose down
```