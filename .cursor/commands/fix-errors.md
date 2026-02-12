---
name: fix-errors
description: Corrige automatiquement les erreurs simples et détectables dans LEON.
---

# Command /fix-errors

Corrige automatiquement les erreurs simples et détectables dans le code LEON.

## Workflow

### 1. Corrections sûres (automatiques)

Ces corrections sont sûres et peuvent être appliquées automatiquement.

#### ESLint auto-fix
```bash
npx eslint app/ lib/ components/ --ext .ts,.tsx --fix
```

#### Prettier (si configuré)
```bash
npx prettier --write "**/*.{ts,tsx,json,css}"
```

#### Imports non utilisés
```bash
# Avec eslint-plugin-unused-imports
npx eslint app/ lib/ components/ --fix --rule "unused-imports/no-unused-imports: error"
```

### 2. Corrections semi-automatiques (avec validation)

Ces corrections nécessitent une validation humaine.

#### Console.log orphelins

```bash
# Lister pour review
grep -rn "console\.log" --include="*.ts" --include="*.tsx" app/ lib/ components/ | grep -v "\["

# Script de suppression (après review)
# Garder uniquement les logs avec préfixes: [PLAYER], [TRANSCODE], [API], [DB]
```

**Règle**: Supprimer tous les `console.log` SAUF ceux avec préfixe structuré.

#### Try/catch silencieux

```typescript
// Détection
grep -rn "catch.*{" --include="*.ts" --include="*.tsx" -A3 | grep -B2 "^\s*}"

// Pattern de correction
// AVANT
try {
  await action()
} catch (e) {
}

// APRÈS  
try {
  await action()
} catch (error) {
  console.error('[CONTEXT] Action failed:', error)
  throw error // ou gestion appropriée
}
```

### 3. Corrections manuelles (suggestions)

Ces corrections ne peuvent pas être automatisées et nécessitent du jugement.

#### Types any → types explicites

```typescript
// Le script peut identifier, mais la correction est manuelle
// car le type correct dépend du contexte

// Suggestion d'action
// Fichier: components/SeriesModal.tsx:55
// Contexte: const [episodes, setEpisodes] = useState<any>([])
// Suggestion: useState<Episode[]>([])
```

### Commandes de correction

```bash
# 1. Corrections ESLint sûres
npx eslint . --fix

# 2. Organiser les imports
npx eslint . --fix --rule "import/order: error"

# 3. Supprimer imports non utilisés
npx eslint . --fix --rule "no-unused-vars: error"

# 4. Formatter le code
npx prettier --write .
```

## Format du rapport

```
═══════════════════════════════════════════════════════════════════
                    CORRECTIONS AUTOMATIQUES - LEON
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│ ✅ CORRECTIONS APPLIQUÉES                                        │
├─────────────────────────────────────────────────────────────────┤
│ Imports réorganisés           : 23 fichiers                      │
│ Imports inutilisés supprimés  : 12 imports                       │
│ Formatage corrigé             : 45 fichiers                      │
│ Point-virgules ajoutés        : 8 lignes                         │
│ Espaces corrigés              : 156 lignes                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ⚠️  CORRECTIONS EN ATTENTE (nécessitent validation)              │
├─────────────────────────────────────────────────────────────────┤
│ Console.log à supprimer       : 45 occurrences                   │
│   → Voir liste: /tmp/console-logs-to-remove.txt                  │
│                                                                  │
│ Try/catch silencieux          : 2 occurrences                    │
│   → lib/transcoding-service.ts:234                               │
│   → components/SeriesModal.tsx:107                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📝 CORRECTIONS MANUELLES SUGGÉRÉES                               │
├─────────────────────────────────────────────────────────────────┤
│ Types 'any' à corriger        : 105 occurrences                  │
│   → Top 5:                                                       │
│     1. SeriesModal.tsx:55     → useState<Episode[]>              │
│     2. useFavorites.ts:117    → FavoriteItem                     │
│     3. api/media/route.ts:23  → MediaResponse                    │
│     4. transcoding/ffmpeg-executor.ts → types explicites         │
│     5. hls-config.ts:12       → HLSConfig                        │
│                                                                  │
│ @ts-ignore à documenter       : 3 occurrences                    │
│   → Ajouter justification ou corriger le type                    │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════

✅ 88 corrections automatiques appliquées
⚠️  47 corrections en attente de validation
📝 108 corrections manuelles suggérées

Prochaines étapes:
1. Vérifier les fichiers modifiés: git diff
2. Valider les console.log à supprimer
3. Invoquer @typescript-guardian pour les types 'any'
```

## Options

- `/fix-errors` — Corrections sûres uniquement
- `/fix-errors --all` — Incluant corrections semi-automatiques
- `/fix-errors --dry-run` — Simuler sans modifier
- `/fix-errors --report` — Générer rapport sans corriger

## Ce qui est corrigé automatiquement

| Type | Auto-fix | Exemple |
|------|----------|---------|
| Formatage | ✅ | Indentation, espaces |
| Imports ordre | ✅ | Réorganisation |
| Imports inutilisés | ✅ | Suppression |
| Point-virgules | ✅ | Ajout/suppression |
| Quotes | ✅ | Simple vs double |
| Trailing commas | ✅ | Ajout/suppression |

## Ce qui n'est PAS corrigé automatiquement

| Type | Raison | Action |
|------|--------|--------|
| Types any | Contexte nécessaire | @typescript-guardian |
| Try/catch vides | Jugement nécessaire | Review manuelle |
| Console.log | Certains sont intentionnels | Review manuelle |
| @ts-ignore | Peut cacher un vrai problème | Review manuelle |

## Sécurité

⚠️ **Toujours faire un commit AVANT d'exécuter `/fix-errors`**

```bash
# Avant corrections
git add -A && git commit -m "chore: before auto-fix"

# Exécuter corrections
/fix-errors

# Vérifier
git diff

# Si OK
git add -A && git commit -m "chore: auto-fix lint errors"

# Si problème
git checkout .
```
