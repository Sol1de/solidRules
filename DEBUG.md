# 🐛 Guide de Debug pour WSL

## 🚀 Étapes pour tester l'extension

### 1. **Build du projet**
```bash
npm run build
```

### 2. **Lancer le debug**
- Appuyez sur `F5` ou
- Menu `Run` → `Start Debugging` ou  
- Utilisez la configuration "Run Extension"

### 3. **Si erreur de tâche**
Si vous obtenez l'erreur `Could not find the task`, suivez ces étapes :

1. **Commande Palette** (`Ctrl+Shift+P`)
2. Tapez `Tasks: Run Task`
3. Sélectionnez `npm: build`
4. Puis relancez avec `F5`

### 4. **Alternative manuelle**
```bash
# Terminal 1: Build en watch mode
npm run build:watch

# Terminal 2 ou F5: Lancer le debug
```

## ✅ Extension lancée avec succès

Une fois l'extension lancée, vous devriez voir :
- Une nouvelle fenêtre VSCode s'ouvrir
- L'icône "SolidRules" dans la sidebar
- Les panneaux : Rules Explorer, Active Rules, Favorites

## 🔧 Problèmes courants WSL

### **Permissions**
```bash
chmod +x node_modules/.bin/*
```

### **Path issues**
Assurez-vous d'être dans le bon répertoire :
```bash
pwd
# Devrait afficher: /home/solide/projet/vscodeExtensionRules
```

### **Node version**
```bash
node --version  # Doit être >= 16
npm --version
``` 