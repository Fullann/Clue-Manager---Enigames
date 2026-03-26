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

1. Lancer l'application + MySQL:

```bash
docker compose up --build -d
```

2. Ouvrir l'application:

- http://localhost:3000

3. Arreter les conteneurs:

```bash
docker compose down
```

Notes:
- la config Docker par defaut est deja integree dans `docker-compose.yml`
- si tu veux personnaliser les variables, copie `.env.docker.example` vers `.env.docker` et adapte le fichier Compose
- les donnees MySQL sont persistantes dans le volume `mysql_data`
- les fichiers uploades sont persistants dans le volume `uploads_data`
- pour repartir de zero (volumes supprimes): `docker compose down -v`

## Variables d'environnement

- `PORT` port HTTP de l'application (defaut `3000`)
- `JWT_SECRET` secret JWT admin
- `ADMIN_PASSWORD` mot de passe admin initial (utilise uniquement au premier lancement)
- `MYSQL_HOST` hote MySQL
- `MYSQL_PORT` port MySQL (defaut `3306`)
- `MYSQL_USER` utilisateur MySQL
- `MYSQL_PASSWORD` mot de passe MySQL
- `MYSQL_DATABASE` base de donnees MySQL

## Deploiement GitHub Actions vers o2switch

Le workflow `.github/workflows/deploy.yml`:
- build le front + serveur
- installe les dependances de production dans GitHub Actions
- envoie les artefacts via SFTP (sans SSH)

### Secrets GitHub requis

- `SFTP_HOST`
- `SFTP_USER`
- `SFTP_PASSWORD`
- `SFTP_PORT`
- `APP_PATH` (exemple: `/home/<user>/votre-domaine/app`)

### Configuration o2switch conseillee

- Creer l'application Node.js depuis le cPanel o2switch
- Version Node.js: 20
- Point d'entree: `server.js`
- Repertoire de l'application: meme valeur que `APP_PATH`
- Ajouter les variables d'environnement dans cPanel
- Verifier que la base MySQL est creee et accessible avec les identifiants definis
