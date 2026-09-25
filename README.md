# Job Search HQ

Plateforme personnelle de recherche d'emploi : collecte d'offres multi-sources, score de compatibilité avec mon profil calculé en code (jamais confié à un LLM), détection d'offres "cachées" (hors LinkedIn/Indeed), génération de CV + lettres de motivation ciblés, suivi de candidatures en Kanban, relances automatiques par email.

Projet perso, mono-utilisateur (inscriptions désactivées), construit comme pièce de portfolio en suivant une philosophie **"je code, l'IA guide"** : chaque fonctionnalité a été écrite à la main, feature branch par feature branch, avec Claude Code en rôle de guide technique (explications, revue, tests) plutôt que d'auto-implémentation.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Stack et pourquoi ces choix](#stack-et-pourquoi-ces-choix)
- [Modèle de données](#modèle-de-données)
- [Lancer le projet en local](#lancer-le-projet-en-local)
- [Tests](#tests)
- [Coût](#coût)
- [Décisions techniques notables](#décisions-techniques-notables)
- [Ce qui n'est pas fait](#ce-qui-nest-pas-fait)

## Fonctionnalités

- **Authentification** — Supabase Auth, inscription publique désactivée (usage strictement personnel), toutes les routes protégées par middleware.
- **Profil** — CV maître structuré (JSON éditable), poids de score personnalisables, clé API LLM chiffrée (AES-256-GCM) avec test de validité avant enregistrement.
- **Collecte d'offres** — déclenchée par un bouton, exécutée en arrière-plan par un worker Python (GitHub Actions) :
  - APIs publiques : [Arbeitnow](https://www.arbeitnow.com/api), [Adzuna](https://developer.adzuna.com/)
  - Plateformes en mode invité via [JobSpy](https://github.com/speedyapply/JobSpy) (LinkedIn, Indeed)
  - Pages carrière ATS : Greenhouse, Lever (liste curée d'entreprises, chaque identifiant vérifié manuellement — voir `worker/sources/ats_companies.py`)
  - Import manuel d'une URL d'offre (utile pour LinkedIn vu en étant connecté)
  - Dédoublonnage cross-source (même offre trouvée sur 3 sites = une seule ligne, avec fusion des sources)
- **Score de matching 1–100** — un LLM évalue 4 sous-scores (compétences techniques, soft skills, expérience, langues) avec justification ; **le score final pondéré est calculé en code**, jamais renvoyé tel quel par le modèle. Règle éliminatoire : allemand C1+ exigé → score plafonné à 40.
- **Badge "offre cachée"** — détecte les offres trouvées via ATS/API mais absentes des grandes plateformes (comparaison floue par trigram Postgres, `pg_trgm`) sur les 30 derniers jours.
- **Fiche offre détaillée** — skills manquants classés par impact, liens d'apprentissage curés (pas d'URL inventée par le LLM), infos entreprise (kununu, Glassdoor, LinkedIn).
- **Génération CV + lettre de motivation** — un LLM sélectionne/reformule les points forts pertinents à partir du CV maître (jamais de fait inventé — garanti structurellement : les champs d'identité/dates/entreprise ne passent jamais par le schéma de sortie du LLM), aperçu éditable, export PDF (`@react-pdf/renderer`), sauvegarde automatique dans le suivi de candidature.
- **Suivi de candidatures** — Kanban avec glisser-déposer natif (HTML5 Drag & Drop), historique des changements de statut (chaque statut n'est journalisé qu'une fois, pas à chaque aller-retour), réinitialisation de l'historique si on revient sciemment à "à postuler".
- **Relances** — créées automatiquement (J+7 après passage en "Postulé"), panneau des relances du jour, email récapitulatif quotidien via cron Vercel + Resend.
- **Réseautage** — contacts par candidature, génération de messages LinkedIn (demande de connexion ≤300 caractères, relance, remerciement) — toujours copiés-collés à la main, aucune automatisation LinkedIn.
- **Suivi du coût LLM** — chaque appel (scoring, génération CV/lettre, messages) journalise ses tokens ; coût estimé en $ pour le scoring (via `litellm.completion_cost`).

## Architecture

```
[Navigateur] ──► [App web Next.js — Vercel]
                     │  ├─ pages : offres, fiche offre, candidatures, réglages
                     │  ├─ génération CV / lettre / message LinkedIn (LLM)
                     │  └─ bouton "Scraper" ──► déclenche ──┐
                     ▼                                       ▼
              [Supabase]  ◄──── écrit offres + scores ── [Worker Python — GitHub Actions]
              Postgres + Auth + Stockage PDF               ├─ collecte multi-sources
                                                             ├─ dédoublonnage + badge "cachée"
                                                             └─ scoring LLM
                     ▲
                     │
              [Cron Vercel 1×/jour] ──► email relances (Resend)
```

Le worker tourne à part parce qu'un scraping + notation de dizaines d'offres prend plusieurs minutes — trop long pour une fonction serverless gratuite, mais gratuit et confortable sur GitHub Actions (minutes illimitées sur un repo public, déclenché à la demande via `workflow_dispatch`).

## Stack et pourquoi ces choix

| Brique | Choix | Pourquoi |
|---|---|---|
| App web | Next.js 16 (App Router) + TypeScript + Tailwind | Stack la plus demandée sur les postes Fullstack/Frontend/Solutions Engineer visés — le projet sert aussi de preuve de compétence. |
| Base de données + Auth | Supabase (Postgres) | SQL classique + Auth + Storage + Row Level Security intégrés, sans avoir à coder l'auth soi-même. |
| Hébergement web | Vercel | Déploiement automatique à chaque push, cron jobs natifs. |
| Worker | Python sur GitHub Actions | Python a l'écosystème de scraping d'emploi le plus riche ([JobSpy](https://github.com/speedyapply/JobSpy)) ; Python est aussi une compétence recherchée sur les rôles cibles. |
| LLM (web) | [Vercel AI SDK](https://sdk.vercel.dev/) | Une interface unique pour Anthropic / OpenAI / Google — l'utilisateur apporte sa propre clé (BYO key), au choix parmi les trois. |
| LLM (worker) | [LiteLLM](https://www.litellm.ai/) | Même rôle côté Python, avec en prime `completion_cost()` pour l'estimation de coût par appel sans maintenir de table de prix. |
| PDF | `@react-pdf/renderer` | CV/lettre définis comme des composants React, rendus en PDF sans navigateur headless. |
| Emails | [Resend](https://resend.com/) | 3000 emails/mois gratuits, suffisant pour un usage personnel. |

Next.js/React/Python plutôt que Rails (que je connais mieux) : pas de serveur à garder allumé en permanence pour rester gratuit, écosystème IA multi-fournisseurs et scraping bien plus riche en TS/Python, et alignement plus direct avec la stack recherchée dans mes candidatures.

## Modèle de données

Tables principales (Postgres, RLS sur chaque table — une seule ligne au monde par utilisateur puisque les inscriptions sont désactivées) :

`profile` (CV maître + poids de score) · `llm_credentials` (clé chiffrée) · `scrape_runs` · `companies` · `jobs` · `job_scores` · `learning_resources` · `applications` · `application_events` · `reminders` · `contacts` · `outreach_messages` · `llm_usage`

Détail des migrations dans `web/supabase/migrations/`.

## Lancer le projet en local

Prérequis : un projet Supabase, une clé LLM (Anthropic, OpenAI ou Google), Node.js et Python 3.12+.

```bash
# Web
cd web
npm install
cp .env.local.example .env.local   # puis compléter avec tes propres valeurs
npx supabase db push               # applique les migrations
npm run dev

# Worker (exécution manuelle en local, sinon via GitHub Actions)
cd worker
cp .env.example .env               # puis compléter avec tes propres valeurs
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Variables d'environnement principales (web) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_MASTER_KEY`, `GITHUB_PAT`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` (pour déclencher le worker), `CRON_SECRET`, `RESEND_API_KEY`, `REMINDER_EMAIL_TO`, `NEXT_PUBLIC_APP_URL`.

Variables principales (worker) : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_USER_ID`, `ENCRYPTION_MASTER_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`.

## Tests

```bash
cd web && npm test        # Vitest
cd worker && pytest       # pytest
```

Pas une couverture exhaustive — quelques tests ciblés sur la logique la plus sensible : le calcul du score pondéré et la règle du plafond allemand C1 (`worker/tests/test_scoring.py`), le nettoyage HTML des descriptions (`worker/tests/test_strip_html.py`), la validation des URL LinkedIn (`web/src/lib/validate-linkedin-url.test.ts`). Ces deux suites, plus `tsc --noEmit`, tournent automatiquement sur chaque pull request (`.github/workflows/test.yml`).

## Coût

Objectif < 5 €/mois : hébergement web (Vercel), base de données (Supabase) et emails (Resend) restent dans leurs paliers gratuits pour un usage personnel. Seul coût variable : les appels LLM, minimisés par un modèle économique pour le scoring (Haiku/mini/Flash) et un modèle plus capable réservé aux générations ponctuelles (CV, lettres, messages). Le coût réel est suivi dans l'app (page Réglages) via la table `llm_usage`.

## Décisions techniques notables

- **Le score final n'est jamais celui renvoyé par le LLM** — le modèle ne fournit que des sous-scores + justification ; la moyenne pondérée et la règle éliminatoire allemand C1 sont calculées en code (`compute_final_score`, testé unitairement), pour rester reproductibles indépendamment des variations d'un modèle à l'autre.
- **Anti-hallucination structurel plutôt qu'instructionnel** pour la génération de CV/lettre : les schémas Zod envoyés au LLM omettent purement et simplement les champs d'identité, dates, entreprise — le modèle ne peut pas halluciner ce qu'il n'a pas le droit de renvoyer.
- **Dédoublonnage cross-source** exact (pas flou) pour fusionner une même offre vue sur plusieurs sites ; comparaison floue (`pg_trgm`) réservée à la détection d'offres "cachées", où l'objectif est différent (repérer une ressemblance, pas garantir une identité).
- **Aucune automatisation LinkedIn** : les messages générés sont toujours copiés-collés manuellement — choix délibéré pour ne faire courir aucun risque au compte LinkedIn personnel.
- **Historique de candidature idempotent** : un statut n'est journalisé qu'une fois (la première fois qu'il est atteint), pour qu'un aller-retour accidentel sur le Kanban ne laisse pas croire qu'une action (ex. "postuler") s'est produite plusieurs fois.

## Ce qui n'est pas fait

- Liste d'entreprises ATS volontairement modeste (10 aujourd'hui, le plan en visait ~150) — voir `worker/sources/ats_companies.py`.
- Pas de template CV "Lebenslauf" allemand (une seule variante ATS-friendly pour l'instant).
- Le niveau d'allemand requis est calculé par le LLM à chaque scoring mais n'est pas persisté en base (nécessiterait une migration dédiée).
- Coût $ non calculé pour les appels LLM côté web (CV/lettre, messages) — seuls les tokens sont suivis, faute de source de prix par modèle équivalente à `litellm.completion_cost` côté TypeScript.
