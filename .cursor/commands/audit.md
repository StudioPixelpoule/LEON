# /audit — Audit Qualité LEON

## Usage

Exécuter `/audit` pour un audit complet du projet.

## Audit Code

### Console.log

```bash
# Compter les console.log
grep -r "console.log" --include="*.ts" --include="*.tsx" | wc -l
```

**Cible** : 0 en production (utiliser logger préfixé)

### Types any

```bash
# Compter les any
grep -r ": any" --include="*.ts" --include="*.tsx" | wc -l
```

**Cible** : < 20 (documentés)

### TODOs

```bash
# Lister les TODOs
grep -r "TODO" --include="*.ts" --include="*.tsx"
```

**Cible** : Tous documentés avec issue

### @ts-ignore

```bash
# Compter les @ts-ignore
grep -r "@ts-ignore" --include="*.ts" --include="*.tsx" | wc -l
```

**Cible** : 0

## Audit Sécurité

### RLS Supabase

```sql
-- Vérifier RLS activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('playback_positions', 'favorites', 'profiles');
```

### Variables d'Environnement

- [ ] `SUPABASE_SERVICE_ROLE_KEY` non exposé
- [ ] `.env` dans `.gitignore`
- [ ] Pas de secrets dans le code

### Authentification

- [ ] Routes API protégées
- [ ] Auth.getUser() avant opérations sensibles

## Audit Performance

### Bundle Size

```bash
# Analyser le bundle
npm run build
# Vérifier .next/analyze/client.html si configuré
```

### Fichiers Volumineux

```bash
# Fichiers > 500 lignes
find . -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20
```

**Fichiers connus volumineux** :
- `transcoding-service.ts` : 1847 lignes
- `SimpleVideoPlayer.tsx` : ~3000 lignes (à refactorer)
- `ffmpeg-manager.ts` : 452 lignes

## Audit Dépendances

```bash
# Dépendances obsolètes
npm outdated

# Vulnérabilités
npm audit
```

## Format de Rapport

```markdown
# Audit LEON

**Date** : [Date]
**Version** : [Tag/Commit]

## Résumé Exécutif

| Catégorie | Score | Détails |
|-----------|-------|---------|
| Code Quality | ⭐⭐⭐ | X any, Y console.log |
| Sécurité | ⭐⭐⭐⭐ | RLS OK, Auth OK |
| Performance | ⭐⭐⭐ | Bundle OK, 3 fichiers lourds |
| Dépendances | ⭐⭐⭐⭐ | 2 obsolètes, 0 vulnérables |

## Détails

### Code Quality

| Métrique | Actuel | Cible | Statut |
|----------|--------|-------|--------|
| console.log | X | 0 | ⚠️ |
| any | X | <20 | ✅/❌ |
| TODO | X | documentés | ⚠️ |
| @ts-ignore | X | 0 | ✅/❌ |

### Sécurité

| Check | Statut |
|-------|--------|
| RLS playback_positions | ✅/❌ |
| RLS favorites | ✅/❌ |
| Secrets protégés | ✅/❌ |
| Auth routes API | ✅/❌ |

### Performance

| Fichier | Lignes | Action |
|---------|--------|--------|
| SimpleVideoPlayer.tsx | ~3000 | Refactorer |
| transcoding-service.ts | 1847 | Acceptable |

### Dépendances

| Package | Actuel | Dernier | Priorité |
|---------|--------|---------|----------|
| ... | ... | ... | ... |

## Actions Prioritaires

1. [ ] [Action haute priorité]
2. [ ] [Action moyenne priorité]
3. [ ] [Action basse priorité]
```

## Métriques de Référence

### Cibles Projet LEON

| Métrique | Cible | Notes |
|----------|-------|-------|
| console.log | 0 prod | Logger préfixé OK |
| any | < 20 | Documentés |
| Fichiers > 1000 lignes | < 5 | Refactorer |
| Vulnérabilités npm | 0 high/critical | |
| Coverage tests | > 60% | (futur) |
