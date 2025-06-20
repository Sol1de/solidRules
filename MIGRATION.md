# Migration vers les Project Rules Cursor

## 🔄 Migration du format `.cursorrules` vers `.cursor/rules`

SolidRules supporte maintenant le **nouveau format Project Rules** de Cursor, qui remplace le format legacy `.cursorrules`.

### ⚡ Changements principaux

| Aspect | Format Legacy | Nouveau Format |
|--------|---------------|----------------|
| **Emplacement** | `.cursorrules` (fichier unique) | `.cursor/rules/` (répertoire) |
| **Format** | Texte brut | MDC (Markdown + métadonnées YAML) |
| **Organisation** | Un seul fichier combiné | Un fichier par règle |
| **Statut** | ⚠️ Déprécié | ✅ Recommandé |

### 📁 Structure des fichiers

#### Avant (Legacy)
```
projet/
├── .cursorrules              # Fichier unique combiné
└── cursorRules/              # Répertoire de sauvegarde
    ├── react-typescript.cursorrules
    └── tailwind-css.cursorrules
```

#### Après (Project Rules)
```
projet/
├── .cursor/
│   └── rules/                # Nouveau répertoire standard
│       ├── react-typescript.mdc
│       ├── tailwind-css.mdc
│       └── python-fastapi.mdc
└── cursorRules/              # Optionnel (si maintainLegacyFormat = true)
```

### 🔧 Format des fichiers

#### Ancien format (.cursorrules)
```markdown
# SolidRules Metadata
# Name: React TypeScript
# Category: Frontend
# Technologies: react, typescript

You are an expert in React and TypeScript...
```

#### Nouveau format (.mdc)
```yaml
---
description: React TypeScript development rules
globs: "*.{tsx,jsx,ts,js}"
alwaysApply: false
---

<!-- SolidRules Metadata
Name: React TypeScript
Category: Frontend
Technologies: react, typescript
-->

You are an expert in React and TypeScript...
```

### ⚙️ Configuration

#### Paramètres disponibles

```json
{
  "solidrules.maintainLegacyFormat": false,  // Maintenir l'ancien format
  "solidrules.rulesDirectory": "cursorRules" // Répertoire legacy
}
```

#### Migration automatique

L'extension utilise maintenant **automatiquement** le nouveau format Project Rules :

1. **Par défaut** : Crée les règles dans `.cursor/rules/` au format MDC
2. **Option legacy** : Si `maintainLegacyFormat: true`, maintient aussi l'ancien format
3. **Rétrocompatibilité** : Lit encore les anciens fichiers existants

### 🎯 Types de règles automatiques

L'extension détermine automatiquement le type de règle selon les technologies :

| Technologies | Pattern de fichiers | Type |
|-------------|---------------------|------|
| React, TypeScript | `*.{tsx,jsx,ts,js}` | Auto Attached |
| Python | `*.py` | Auto Attached |
| Tailwind, CSS | `*.{css,scss,tsx,jsx}` | Auto Attached |
| SQL, Database | `*.sql` | Auto Attached |
| Autres | - | Manual |

### 🚀 Avantages du nouveau format

1. **Performance** : Cursor charge uniquement les règles pertinentes
2. **Organisation** : Une règle = un fichier
3. **Collaboration** : Meilleur contrôle de version
4. **Flexibilité** : Métadonnées riches et patterns de fichiers
5. **Évolutivité** : Support des nouvelles fonctionnalités Cursor

### 📋 Actions recommandées

1. **Immédiat** : Rien ! L'extension migre automatiquement
2. **Optionnel** : Désactiver `maintainLegacyFormat` pour nettoyer
3. **Équipe** : Partager le répertoire `.cursor/rules` via Git

### 🔍 Vérification

Après activation d'une règle, vérifiez :

```bash
# Nouveau format (recommandé)
ls -la .cursor/rules/

# Ancien format (si maintainLegacyFormat = true)
ls -la cursorRules/
cat .cursorrules
```

### ❓ FAQ

**Q: Mes anciennes règles fonctionnent-elles encore ?**  
R: Oui, l'extension lit encore les anciens fichiers et les migre automatiquement.

**Q: Dois-je supprimer mes anciens fichiers ?**  
R: Non, gardez-les comme sauvegarde. Désactivez `maintainLegacyFormat` pour arrêter leur génération.

**Q: Comment partager les règles avec mon équipe ?**  
R: Committez le répertoire `.cursor/rules/` dans votre repository Git.

**Q: Puis-je revenir à l'ancien format ?**  
R: Activez `maintainLegacyFormat: true` pour maintenir les deux formats.

### 🎉 Conclusion

Cette migration améliore significativement l'expérience avec Cursor tout en maintenant la compatibilité. Le nouveau format Project Rules offre plus de flexibilité et de performance.

**L'extension gère automatiquement la transition - aucune action requise !** 