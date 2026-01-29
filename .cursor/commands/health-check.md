---
name: health-check
description: Vérification rapide de la santé globale du projet LEON. Diagnostic en 1 minute.
---

# Command /health-check

Diagnostic rapide de la santé du projet LEON en moins d'une minute.

## Workflow

### 1. Build check

```bash
# Vérifier que le projet compile
npm run build 2>&1 | tail -20
echo "Exit code: $?"
```

### 2. TypeScript check

```bash
# Vérifier les erreurs TypeScript
npx tsc --noEmit 2>&1 | grep -c "error"
```

### 3. Dépendances

```bash
# Vérifier les dépendances
npm ls --depth=0 2>&1 | grep -c "UNMET"

# Vulnérabilités critiques
npm audit --audit-level=critical 2>&1 | grep -c "critical"
```

### 4. Processus FFmpeg (si sur le serveur)

```bash
# Sessions FFmpeg actives
ps aux | grep -c "[f]fmpeg"

# Mémoire utilisée par FFmpeg
ps aux | grep "[f]fmpeg" | awk '{sum+=$6} END {print sum/1024 "MB"}'
```

### 5. Espace disque cache

```bash
# Taille du cache HLS
du -sh /tmp/leon-cache/ 2>/dev/null || echo "N/A"

# Espace libre
df -h / | tail -1 | awk '{print $4}'
```

### 6. Supabase (si connecté)

```bash
# Vérifier la connexion
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -o /dev/null -w "%{http_code}"
```

### 7. Métriques code

```bash
# Lignes de code
find app/ lib/ components/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1

# Nombre de fichiers
find app/ lib/ components/ -name "*.ts" -o -name "*.tsx" | wc -l

# Types any
grep -rn ": any" --include="*.ts" --include="*.tsx" app/ lib/ components/ | wc -l
```

## Format du rapport

```
═══════════════════════════════════════════════════════════════════
                    HEALTH CHECK - LEON
═══════════════════════════════════════════════════════════════════
                    
┌─────────────────────────────────────────────────────────────────┐
│ COMPILATION                                                      │
├─────────────────────────────────────────────────────────────────┤
│ Build           │ ✅ Succès                                      │
│ TypeScript      │ ✅ 0 erreurs                                   │
│ ESLint          │ ⚠️  12 warnings                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DÉPENDANCES                                                     │
├─────────────────────────────────────────────────────────────────┤
│ NPM             │ ✅ Toutes résolues                             │
│ Vulnérabilités  │ ✅ 0 critiques                                 │
│ Obsolètes       │ ⚠️  5 packages                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE (si disponible)                                   │
├─────────────────────────────────────────────────────────────────┤
│ FFmpeg actifs   │ 1 processus (45MB)                            │
│ Cache HLS       │ 234MB / 5GB                                    │
│ Espace disque   │ ✅ 156GB libre                                 │
│ Supabase        │ ✅ Connecté (200)                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CODE QUALITY                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Fichiers        │ 127 fichiers TS/TSX                           │
│ Lignes          │ 18,432 lignes                                 │
│ Types any       │ 🔴 105 occurrences                            │
│ Console.log     │ 🔴 973 occurrences                            │
│ TODOs           │ 🟡 6 non résolus                              │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════

📊 SCORE SANTÉ: 78/100

✅ Points forts:
• Build stable
• Pas de vulnérabilités critiques
• Supabase connecté

⚠️ Points d'attention:
• 105 types 'any' à éliminer
• 973 console.log à nettoyer
• 5 dépendances obsolètes

🔴 Actions requises:
• Aucune action bloquante

═══════════════════════════════════════════════════════════════════
Durée: 0.8s
```

## Score de santé

Le score est calculé sur 100 points:

| Critère | Points | Condition |
|---------|--------|-----------|
| Build | 25 | Succès = 25, Échec = 0 |
| TypeScript | 20 | 0 erreurs = 20, sinon 0 |
| Vulnérabilités | 15 | 0 critiques = 15, sinon 0 |
| Supabase | 10 | Connecté = 10, sinon 0 |
| Types any | 10 | < 10 = 10, < 50 = 5, sinon 0 |
| Console.log | 10 | < 50 = 10, < 200 = 5, sinon 0 |
| Dépendances | 10 | À jour = 10, < 5 obsolètes = 5 |

## Seuils d'alerte

| Niveau | Score | Action |
|--------|-------|--------|
| 🟢 Sain | 80-100 | Maintenance normale |
| 🟡 Attention | 60-79 | Planifier corrections |
| 🟠 Dégradé | 40-59 | Corrections prioritaires |
| 🔴 Critique | 0-39 | Action immédiate requise |

## Options

- `/health-check` — Check complet
- `/health-check --quick` — Build + TypeScript seulement
- `/health-check --infra` — Infrastructure seulement (FFmpeg, cache)
- `/health-check --code` — Métriques code seulement

## Automatisation

```bash
# Ajouter au pre-commit
# .husky/pre-commit
/health-check --quick
if [ $? -ne 0 ]; then
  echo "Health check failed"
  exit 1
fi
```

```yaml
# CI/CD - vérification quotidienne
# .github/workflows/health.yml
name: Daily Health Check
on:
  schedule:
    - cron: '0 8 * * *'
jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npx tsc --noEmit
```

## Agents suggérés selon résultats

| Problème détecté | Agent à invoquer |
|------------------|------------------|
| Build échoue | @debugger |
| Types any élevés | @typescript-guardian |
| Console.log élevés | @error-hunter |
| FFmpeg bloqué | @streaming-specialist |
| Supabase déconnecté | @database-inspector |
| Vulnérabilités | @security-auditor |
