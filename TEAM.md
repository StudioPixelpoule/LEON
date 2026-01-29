# Équipe d'Agents LEON

Documentation complète de l'équipe d'agents Cursor pour le projet LEON.

## Vue d'ensemble

LEON dispose de **12 agents** et **7 commands** pour couvrir tous les aspects du développement, de la détection d'erreurs, et du déploiement.

### Agents par catégorie

```
┌─────────────────────────────────────────────────────────────────┐
│ ARCHITECTURE & DÉVELOPPEMENT                                    │
├─────────────────────────────────────────────────────────────────┤
│ @architect       → Planification et décisions techniques        │
│ @developer       → Implémentation code propre                   │
│ @documentation   → Documentation technique                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DÉTECTION D'ERREURS & QUALITÉ                                   │
├─────────────────────────────────────────────────────────────────┤
│ @error-hunter        → Chasse aux patterns problématiques       │
│ @typescript-guardian → Qualité des types TypeScript             │
│ @debugger            → Diagnostic et correction de bugs         │
│ @qa-tester           → Tests et validation                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SÉCURITÉ & INFRASTRUCTURE                                       │
├─────────────────────────────────────────────────────────────────┤
│ @security-auditor    → Audit sécurité complet                   │
│ @api-validator       → Validation des routes API                │
│ @database-inspector  → Audit Supabase et RLS                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ STREAMING & PERFORMANCE                                         │
├─────────────────────────────────────────────────────────────────┤
│ @streaming-specialist → Expert FFmpeg et HLS.js                 │
│ @performance-analyst  → Optimisation performance                │
└─────────────────────────────────────────────────────────────────┘
```

### Commands disponibles

```
┌─────────────────────────────────────────────────────────────────┐
│ QUALITÉ CODE                                                    │
├─────────────────────────────────────────────────────────────────┤
│ /lint         → Analyse statique complète                       │
│ /fix-errors   → Corrections automatiques                        │
│ /review       → Revue de code avant PR                          │
│ /audit        → Audit qualité complet                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DIAGNOSTIC & DÉPLOIEMENT                                        │
├─────────────────────────────────────────────────────────────────┤
│ /health-check → Diagnostic rapide du projet                     │
│ /transcode    → Debug streaming et FFmpeg                       │
│ /deploy       → Déploiement Docker sur NAS                      │
└─────────────────────────────────────────────────────────────────┘
```

## Utilisation des agents

### Agents de détection d'erreurs

#### @error-hunter
Chasseur de patterns problématiques dans le code.

**Invoquer pour:**
- Trouver les try/catch silencieux
- Lister les types `any`
- Identifier les console.log orphelins
- Détecter les @ts-ignore non justifiés
- Inventorier les TODOs

**Exemple:**
```
@error-hunter Analyse le fichier lib/transcoding-service.ts
```

#### @typescript-guardian
Gardien de la qualité TypeScript.

**Invoquer pour:**
- Éliminer les types `any`
- Créer des interfaces robustes
- Résoudre des erreurs TypeScript complexes
- Améliorer l'inférence de types

**Exemple:**
```
@typescript-guardian Aide-moi à typer correctement SeriesModal.tsx
```

#### @performance-analyst
Expert en optimisation de performance.

**Invoquer pour:**
- Diagnostiquer des fuites mémoire
- Identifier des re-renders inutiles
- Optimiser les requêtes Supabase
- Analyser les buffers HLS

**Exemple:**
```
@performance-analyst L'app rame après 1h de lecture, pourquoi ?
```

#### @api-validator
Validateur des 63 routes API.

**Invoquer pour:**
- Auditer la validation des inputs
- Vérifier les codes HTTP
- S'assurer de l'authentification
- Prévenir les path traversal

**Exemple:**
```
@api-validator Vérifie la sécurité de /api/hls/[...path]
```

#### @database-inspector
Inspecteur Supabase et RLS.

**Invoquer pour:**
- Auditer les policies RLS
- Optimiser les requêtes N+1
- Vérifier les migrations
- Régénérer les types

**Exemple:**
```
@database-inspector Les policies RLS sont-elles correctes sur playback_positions ?
```

### Agents existants (cursor-config)

#### @architect
Planificateur technique.

**Invoquer pour:**
- Nouvelles fonctionnalités majeures
- Décisions d'architecture
- Roadmap technique

#### @developer
Implémentateur de code propre.

**Invoquer pour:**
- Écrire du nouveau code
- Refactorer du code existant
- Suivre les conventions LEON

#### @debugger
Diagnostiqueur de bugs.

**Invoquer pour:**
- "Ça ne marche pas"
- Stack traces à analyser
- Comportements inattendus

#### @streaming-specialist
Expert FFmpeg et HLS.js.

**Invoquer pour:**
- Problèmes de lecture vidéo
- Configuration FFmpeg
- Erreurs HLS.js

#### @qa-tester
Testeur qualité.

**Invoquer pour:**
- Validation avant release
- Tests de régression
- Scénarios edge case

#### @security-auditor
Auditeur sécurité.

**Invoquer pour:**
- Audit complet sécurité
- Vérification auth
- Analyse des vulnérabilités

#### @documentation
Documentaliste technique.

**Invoquer pour:**
- Documenter du code
- Créer/mettre à jour README
- JSDoc et commentaires

## Workflows recommandés

### Nouvelle fonctionnalité
```
1. @architect      → Planifier l'approche
2. @developer      → Implémenter
3. @qa-tester      → Tester
4. /review         → Revue de code
5. /deploy         → Déployer
```

### Chasse aux erreurs
```
1. /lint           → Analyse statique
2. @error-hunter   → Inventaire détaillé
3. /fix-errors     → Corrections auto
4. @typescript-guardian → Typer les any
5. /review         → Valider les corrections
```

### Problème de streaming
```
1. /transcode      → Diagnostic rapide
2. @streaming-specialist → Analyse FFmpeg/HLS
3. @debugger       → Correction
4. @performance-analyst → Optimisation
```

### Audit sécurité
```
1. @security-auditor    → Audit global
2. @api-validator       → Routes API
3. @database-inspector  → RLS Supabase
4. /audit               → Rapport complet
```

### Avant déploiement
```
1. /health-check   → État du projet
2. /lint           → Qualité code
3. /audit          → Audit complet
4. @security-auditor → Dernière vérification
5. /deploy         → Déploiement
```

## Intégration entre agents

Les agents sont conçus pour collaborer:

```
@error-hunter détecte 105 types 'any'
    ↓
Suggère d'invoquer @typescript-guardian
    ↓
@typescript-guardian crée les interfaces
    ↓
@developer implémente les corrections
    ↓
/lint vérifie le résultat
```

## Métriques cibles

| Métrique | Actuel | Cible | Agent responsable |
|----------|--------|-------|-------------------|
| Types any | 105 | < 10 | @typescript-guardian |
| Console.log | 973 | < 50 | @error-hunter |
| Try/catch vides | 2 | 0 | @error-hunter |
| Couverture RLS | 4/4 | 4/4 | @database-inspector |
| Routes validées | ? | 63/63 | @api-validator |
| Score santé | 78 | > 90 | /health-check |

## Installation

Ces agents sont dans `.cursor/agents/` et les commands dans `.cursor/commands/`.

Cursor les détecte automatiquement à l'ouverture du projet.

```bash
# Vérifier l'installation
ls -la .cursor/agents/
ls -la .cursor/commands/
```

## Mise à jour

Pour mettre à jour les agents:
1. Modifier le fichier dans `.cursor/agents/`
2. Cursor recharge automatiquement

Pour ajouter un nouvel agent:
1. Créer le fichier `.cursor/agents/nouveau-agent.md`
2. Suivre le format avec frontmatter YAML
3. Documenter dans ce fichier TEAM.md
