# Backend - Gestion Immobilière Multi-Rôles (Node.js, Express, Supabase)

Ce projet fournit l'API pour les différents rôles (Client, Promoteur, Ingénieur, Commercial, Admin) avec une gestion d'accès basée sur les rôles (RBAC).

## Prérequis
- [Node.js](https://nodejs.org/) (v16 ou supérieur recommandé)
- Un compte [Supabase](https://supabase.com/) avec un projet actif.

## Installation du Projet

1. **Installer les dépendances** :
   ```bash
   cd backend
   npm install
   ```

2. **Configurer les variables d'environnement** :
   - Dupliquez le fichier `.env.example` et renommez-le en `.env`.
   - Renseignez les variables d'environnement avec les clés d'API de votre projet Supabase.
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   > ⚠️ **Sécurité** : Ne partagez jamais votre `SUPABASE_SERVICE_ROLE_KEY`. Elle permet de contourner toutes les sécurités de votre base de données.

3. **Configurer la base de données dans Supabase** :
   - Connectez-vous sur votre tableau de bord Supabase.
   - Accédez à la section **SQL Editor** dans le menu latéral gauche.
   - Cliquez sur **New Query**.
   - Ouvrez et copiez le contenu du fichier [supabase_setup.sql](file:///c:/Users/pc/Desktop/Promoteur/backend/supabase_setup.sql).
   - Collez le code dans l'éditeur et cliquez sur **Run**.
   - Cela va créer le type de rôles, la table des profils synchronisés (`profiles`), le trigger de synchronisation automatique à l'inscription, ainsi que la table des tâches (`tasks`) et les politiques de sécurité associées.

## Démarrage du Serveur

- **Mode développement** (avec rechargement automatique) :
  ```bash
  npm run dev
  ```
- **Mode production** :
  ```bash
  npm start
  ```

Le serveur écoutera sur le port `5000` par défaut (`http://localhost:5000`).

## Documentation de l'API

### Authentification

- **Inscription d'un utilisateur** :
  - **Méthode** : `POST`
  - **URL** : `/api/auth/register`
  - **Body (JSON)** :
    ```json
    {
      "email": "user@example.com",
      "password": "secretpassword",
      "role": "ingenieur",
      "fullName": "Jean Ingénieur",
      "phone": "+21260000000"
    }
    ```
    > Rôles autorisés : `admin`, `promoteur`, `ingenieur`, `commercial`, `client`.

- **Connexion** :
  - **Méthode** : `POST`
  - **URL** : `/api/auth/login`
  - **Body (JSON)** :
    ```json
    {
      "email": "user@example.com",
      "password": "secretpassword"
    }
    ```
  - **Réponse** :
    ```json
    {
      "message": "Connexion réussie.",
      "token": "JWT_TOKEN_HERE",
      "expiresAt": 1721644000,
      "user": {
        "id": "uuid-here",
        "email": "user@example.com",
        "role": "ingenieur",
        "fullName": "Jean Ingénieur",
        "phone": "+21260000000"
      }
    }
    ```

---

### Gestion des Tâches (Requiert en-tête `Authorization: Bearer <token>`)

- **Récupérer les tâches** :
  - **Méthode** : `GET`
  - **URL** : `/api/tasks`
  - **Comportement** :
    - Si l'utilisateur est un **Ingénieur** : Renvoie uniquement ses tâches assignées.
    - Si l'utilisateur est un **Promoteur**, **Admin**, **Client** ou **Commercial** : Renvoie toutes les tâches.

- **Créer une tâche** :
  - **Méthode** : `POST`
  - **URL** : `/api/tasks`
  - **Accès** : Uniquement **Promoteur** et **Admin**.
  - **Body (JSON)** :
    ```json
    {
      "title": "Finaliser les fondations du Bloc A",
      "description": "Vérifier le coulage du béton pour la structure principale.",
      "assigned_to": "uuid-de-l-ingenieur",
      "due_date": "2026-08-30T12:00:00Z"
    }
    ```

- **Mettre à jour le statut d'une tâche** :
  - **Méthode** : `PATCH`
  - **URL** : `/api/tasks/:id/status`
  - **Accès** : **Ingénieur** (seulement si la tâche lui est assignée), **Promoteur**, **Admin**.
  - **Body (JSON)** :
    ```json
    {
      "status": "in_progress"
    }
    ```
    > Statuts valides : `todo`, `in_progress`, `done`.

---

### Accès aux Pages / Tableaux de bord (Requiert en-tête `Authorization: Bearer <token>`)

Ces routes simulent l'accès aux pages pour valider les règles RBAC du projet :

- **Page Ingénieur** (`GET /api/pages/ingenieur`) :
  - Rôles autorisés : `ingenieur`, `promoteur`, `client`, `admin`
- **Page Commercial** (`GET /api/pages/commercial`) :
  - Rôles autorisés : `commercial`, `promoteur`, `client`, `admin`
- **Page Client** (`GET /api/pages/client`) :
  - Rôles autorisés : `client`, `promoteur`, `admin`
- **Espace Promoteur** (`GET /api/pages/promoteur`) :
  - Rôles autorisés : `promoteur`, `admin`
- **Dashboard Admin** (`GET /api/pages/admin`) :
  - Rôles autorisés : `admin`
