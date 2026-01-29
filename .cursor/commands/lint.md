---
name: lint
description: Analyse statique complète du code LEON. Lance tous les linters et vérifications automatiques.
---

# Command /lint

Exécute une analyse statique complète du code LEON.

## Workflow

### 1. Vérifications TypeScript

```bash
# Compiler sans émettre de fichiers
npx tsc --noEmit

# Si erreurs, les lister avec contexte
npx tsc --noEmit 2>&1 | head -50
```

### 2. ESLint

```bash
# Lint complet
npx eslint app/ lib/ components/ --ext .ts,.tsx

# Avec auto-fix
npx eslint app/ lib/ components/ --ext .ts,.tsx --fix
```

### 3. Recherche de patterns problématiques

```bash
# Types any
echo "=== Types 'any' ==="
grep -rn ": any" --include="*.ts" --include="*.tsx" app/ lib/ components/ | wc -l

# Try/catch silencieux
echo "=== Try/catch potentiellement silencieux ==="
grep -rn "catch.*{" --include="*.ts" --include="*.tsx" app/ lib/ components/ -A2 | grep -B1 "}" | grep -v console

# Console.log (hors logs structurés)
echo "=== Console.log à nettoyer ==="
grep -rn "console\.log" --include="*.ts" --include="*.tsx" app/ lib/ components/ | grep -v "\[" | wc -l

# @ts-ignore
echo "=== @ts-ignore/@ts-expect-error ==="
grep -rn "@ts-ignore\|@ts-expect-error" --include="*.ts" --include="*.tsx" app/ lib/ components/

# TODOs
echo "=== TODOs non résolus ==="
grep -rn "TODO\|FIXME\|XXX\|HACK" --include="*.ts" --include="*.tsx" app/ lib/ components/
```

### 4. Vérification des imports

```bash
# Imports inutilisés (si madge installé)
npx madge --circular --extensions ts,tsx app/ lib/ components/
```

### 5. Vérification des dépendances

```bash
# Dépendances obsolètes
npm outdated

# Vulnérabilités connues
npm audit
```

## Format du rapport

```
═══════════════════════════════════════════════════════════════════
                    ANALYSE STATIQUE - LEON
═══════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────┐
│ TYPESCRIPT                                                       │
├─────────────────────────────────────────────────────────────────┤
│ ✅ Compilation: 0 erreurs                                        │
│ ⚠️  Warnings: 12                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ESLINT                                                          │
├─────────────────────────────────────────────────────────────────┤
│ ❌ Erreurs: 8                                                    │
│ ⚠️  Warnings: 45                                                 │
│ ✅ Auto-fixables: 32                                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PATTERNS PROBLÉMATIQUES                                         │
├─────────────────────────────────────────────────────────────────┤
│ Types 'any'        : 105 occurrences     │ Cible: < 10  │ 🔴   │
│ Console.log        : 973 occurrences     │ Cible: < 50  │ 🔴   │
│ @ts-ignore         : 3 occurrences       │ Cible: 0     │ 🟠   │
│ TODOs              : 6 occurrences       │ Cible: 0     │ 🟡   │
│ Try/catch vides    : 2 occurrences       │ Cible: 0     │ 🔴   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DÉPENDANCES                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Obsolètes          : 5 packages                         │ 🟠   │
│ Vulnérabilités     : 0 critiques, 2 modérées           │ 🟡   │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════

📊 Score global: 65/100

🔴 Actions prioritaires:
1. Corriger les 2 try/catch silencieux
2. Réduire les types 'any' (105 → < 10)
3. Nettoyer les console.log (973 → < 50)

💡 Commandes suggérées:
• /fix-errors     → Corrections automatiques
• @error-hunter   → Analyse détaillée des erreurs
• @typescript-guardian → Éliminer les 'any'
```

## Options

- `/lint` — Analyse complète
- `/lint --fix` — Avec auto-corrections ESLint
- `/lint --quick` — TypeScript + ESLint seulement
- `/lint --patterns` — Patterns problématiques seulement

## Intégration CI/CD

```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint app/ lib/ components/
```

## Seuils de qualité

| Métrique | Actuel | Cible | Bloquant |
|----------|--------|-------|----------|
| Erreurs TypeScript | 0 | 0 | ✅ |
| Erreurs ESLint | < 10 | 0 | 🟠 |
| Types any | < 20 | < 10 | ❌ |
| Console.log non structurés | < 100 | < 50 | ❌ |
