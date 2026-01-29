# /review — Revue de Code LEON

## Usage

Exécuter `/review` avant chaque PR ou merge.

## Checklist Automatique

### TypeScript & Qualité

```bash
# Type check
npx tsc --noEmit

# ESLint
npm run lint

# Build
npm run build
```

### Revue Code

#### Conventions

- [ ] Nommage correct (PascalCase composants, camelCase fonctions)
- [ ] Imports organisés (React → External → Internal → Types → Styles)
- [ ] Exports nommés (pas default)
- [ ] CSS Modules utilisés

#### TypeScript

- [ ] Pas de `any` non documenté
- [ ] Props typées avec interface
- [ ] Retours de fonctions typés
- [ ] Pas de `@ts-ignore` non justifié

#### Gestion Erreurs

- [ ] Try/catch sur opérations risquées
- [ ] Pas de catch silencieux
- [ ] Messages d'erreur explicites
- [ ] Logs préfixés (`[PLAYER]`, `[API]`, etc.)

#### Sécurité

- [ ] Auth vérifié avant opérations sensibles
- [ ] Inputs validés côté serveur
- [ ] Pas de secrets côté client
- [ ] RLS respecté

#### Performance

- [ ] Pas de re-renders inutiles
- [ ] useCallback/useMemo si nécessaire
- [ ] Lazy loading pour composants lourds
- [ ] Images optimisées (next/image)

### Fichiers Modifiés

Pour chaque fichier modifié, vérifier :

```markdown
## [Nom du fichier]

### Changements
- [Description des modifications]

### Risques
- [Impacts potentiels]

### Tests
- [ ] Test unitaire ajouté/mis à jour
- [ ] Test manuel effectué
```

## Format de Rapport

```markdown
# Revue de Code

**Branch** : [feature/xxx]
**Date** : [Date]
**Reviewer** : /review

## Résumé

| Check | Statut |
|-------|--------|
| TypeScript | ✅/❌ |
| ESLint | ✅/❌ |
| Build | ✅/❌ |
| Conventions | ✅/❌ |
| Sécurité | ✅/❌ |

## Points d'Attention

### ⚠️ À Corriger

1. [Description problème]
   - Fichier : `path/to/file.ts:42`
   - Suggestion : [Code ou explication]

### 💡 Suggestions

1. [Amélioration optionnelle]

## Verdict

- [ ] ✅ Approuvé — Prêt pour merge
- [ ] ⚠️ Approuvé avec réserves — Corriger avant prod
- [ ] ❌ Refusé — Corrections requises
```

## Commandes Utiles

```bash
# Différences avec main
git diff main --stat

# Fichiers modifiés
git diff main --name-only

# Vérification complète
npm run lint && npx tsc --noEmit && npm run build
```
