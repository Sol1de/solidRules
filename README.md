# SolidRules - VSCode Extension

**Professional Visual CursorRules Manager for AI-powered Development**

SolidRules is a powerful VSCode extension that provides a visual and intuitive way to manage CursorRules from the [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) repository. Designed specifically for AI-powered development with Cursor IDE and other AI code editors.

## 🚀 Key Features

### **Ultra-Fast Performance System**
- **⚡ Instant Toggle**: 5-10ms response time (30x faster than before)
- **🔄 Smart Synchronization**: Background file operations with lazy loading
- **🎯 Zero Latency**: Immediate visual feedback with deferred workspace updates
- **📊 Optimized Architecture**: Database-first approach with intelligent file sync

### **Visual Rule Management**
- **🌳 Tree View Explorer**: Browse rules organized by categories and technologies
- **🔍 Advanced Search**: Smart search with technology and category filters
- **⭐ Favorites System**: Save frequently used rules for quick access
- **👁️ Preview Mode**: View rule content before activation
- **✅ Visual Indicators**: Green badges and icons for active rules

### **One-Click Activation**
- **🖱️ Single Click Toggle**: Left-click any rule to activate/deactivate instantly
- **🎨 Visual Feedback**: Immediate green checkmarks and styling
- **🚫 No Menu Required**: Direct interaction without context menus
- **⚡ Batch Operations**: Multiple rules can be toggled rapidly

### **Multi-Workspace Support**
- **📁 Workspace-Specific Rules**: Each workspace maintains its own active rules
- **🗂️ Modern Project Rules**: Uses `.cursor/rules/` format with MDC files
- **🔄 Legacy Compatibility**: Supports old `.cursorrules` format
- **🎯 Smart File Organization**: Automatic cleanup and intelligent file management

### **Auto-Update System**
- **🔄 GitHub Sync**: Automatic synchronization with the latest rules
- **📢 Update Notifications**: Smart notifications for rule updates
- **📝 Version Tracking**: Keep track of rule versions and changes
- **⚡ Rate Limit Optimization**: Intelligent API usage with token support

### **Custom Rules Support**
- **📝 Import Custom Rules**: Add your own rules in modern MDC format
- **🏷️ Technology Tagging**: Organize custom rules with technologies and tags
- **📤 Export Functionality**: Share rule collections easily
- **🎨 Rich Metadata**: Full support for YAML frontmatter and descriptions

## 📋 Requirements

- **VSCode**: Version 1.85.0 or higher
- **Node.js**: Version 16 or higher (for development)
- **Internet Connection**: Required for fetching rules from GitHub
- **Optional**: GitHub Personal Access Token for higher rate limits

## 🛠 Installation

### From VSCode Marketplace (Recommended)
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "SolidRules"
4. Click Install

### Manual Installation
1. Download the `.vsix` file from releases
2. Open VSCode
3. Go to Extensions → Install from VSIX
4. Select the downloaded file

## 🎯 Quick Start

### 1. **Activate the Extension**
- After installation, you'll see the SolidRules icon in the Activity Bar
- Click on it to open the SolidRules panel

### 2. **Browse and Select Rules**
- Explore rules organized by categories (Frontend, Backend, Mobile, etc.)
- Use the search box to find specific rules
- **Single left-click** on any rule to activate/deactivate it instantly
- Watch for the green ✅ checkmark indicating active rules

### 3. **Configure GitHub Token (Optional but Recommended)**
```bash
# Get better rate limits (5000/hour vs 60/hour)
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a token with public repository read access
3. In VSCode: Ctrl+Shift+P → "SolidRules: Configure GitHub Token"
4. Paste your token
```

### 4. **Workspace Integration**
- Active rules are automatically written to your workspace
- Modern format: `.cursor/rules/` directory with individual MDC files
- Legacy support: `.cursorrules` file for backward compatibility

## 📚 Usage Guide

### **Ultra-Fast Rule Management**

#### **Instant Activation**
```bash
# Simply click any rule to toggle it
✅ React TypeScript    # Active (green checkmark)
   Vue.js              # Inactive
🟢 Python FastAPI     # Just activated (immediate feedback)
```

#### **Performance Architecture**
- **Database Update**: 5-10ms (instant)
- **UI Refresh**: 0ms (immediate)
- **File Sync**: 2s delayed (background)
- **Result**: 30x faster than traditional approaches

### **Search and Filter**
```bash
# Search by name, technology, or content
Search: "react typescript"

# Filter by technology
Filter → Technology → React

# Filter by category
Filter → Category → Frontend

# Sort options
Sort → Recent | Alphabetical | Popularity
```

### **Workspace File Structure**
```
your-project/
├── .cursor/
│   └── rules/                # Modern Project Rules (recommended)
│       ├── react-typescript.mdc
│       ├── tailwind-css.mdc
│       └── python-fastapi.mdc
├── cursorRules/              # Legacy directory (optional)
│   └── *.cursorrules
├── .cursorrules              # Legacy master file (optional)
└── ...
```

### **Custom Rules Management**
1. Click the "+" button in Rules Explorer
2. Enter rule name and select file
3. Add technologies and tags
4. Rule is imported and ready to use

## ⚙️ Configuration

### **Extension Settings**
```json
{
  "solidrules.autoRefresh": false,              // Auto-refresh on startup
  "solidrules.refreshInterval": 24,             // Refresh interval (hours)
  "solidrules.rulesDirectory": "cursorRules",   // Legacy rules directory
  "solidrules.enableNotifications": true,      // Enable update notifications
  "solidrules.defaultSortOrder": "recent",     // Default sort order
  "solidrules.githubToken": "",                // GitHub token for higher limits
  "solidrules.maintainLegacyFormat": false     // Keep old .cursorrules format
}
```

### **Access Settings**
- Command Palette: `SolidRules: Settings`
- Or: File → Preferences → Settings → Extensions → SolidRules

## 🧪 Testing Your Rules

### **Verify Files Are Created**
```bash
# Check modern format
ls -la .cursor/rules/

# Check legacy format (if enabled)
ls -la cursorRules/
cat .cursorrules
```

### **Test in Cursor IDE**
1. **Activate** a React TypeScript rule via SolidRules
2. **Create** a new `.tsx` file
3. **Ask Cursor**: "Create a React Button component with TypeScript"
4. **Verify** Cursor follows the rule's conventions

### **Example Rule Content (MDC Format)**
```yaml
---
description: "React TypeScript development best practices"
globs: "*.{tsx,jsx,ts,js}"
alwaysApply: false
---

<!-- Generated by SolidRules Extension
Rule: React TypeScript | Category: Frontend
Technologies: react, typescript
Source: awesome-cursorrules
-->

You are an expert in React and TypeScript...
```

## 🔧 Development

### **Setup Development Environment**
```bash
# Clone the repository
git clone https://github.com/solidrules/solidrules-vscode.git
cd solidrules-vscode

# Install dependencies
npm install

# Build the extension
npm run build

# Run in development mode
npm run build:watch
```

### **Debug in WSL**
```bash
# Build first
npm run build

# Launch debug (F5) or
# If task error: Ctrl+Shift+P → "Tasks: Run Task" → "npm: build"
```

### **Project Architecture**
```
src/
├── extension.ts              # Main extension entry point
├── types/index.ts           # TypeScript definitions
├── managers/                # Core business logic
│   ├── RulesManager.ts      # Ultra-fast rule management
│   ├── DatabaseManager.ts   # VSCode native storage
│   ├── WorkspaceManager.ts  # File operations
│   ├── CommandManager.ts    # VSCode commands
│   └── NotificationManager.ts
├── providers/               # Tree view providers
│   ├── RulesExplorerProvider.ts
│   ├── ActiveRulesProvider.ts
│   └── FavoritesProvider.ts
├── services/               # External services
│   └── GitHubService.ts    # GitHub API integration
└── decorators/            # Visual enhancements
    └── ActiveRuleDecorator.ts
```

## 🚀 Performance Optimizations

### **Ultra-Fast System Architecture**
```
User Click (0ms)
    ↓
Database Update (5-10ms)
    ↓
UI Refresh (0ms - immediate)
    ↓ (2s delay)
Workspace File Sync (background)
```

### **Key Optimizations**
- **Eliminated SQLite3**: Replaced with VSCode native storage
- **Lazy Synchronization**: File operations happen in background
- **Smart Batching**: Multiple clicks grouped into single operation
- **Visual Decorators**: Native VSCode styling for active rules
- **Rate Limit Management**: Intelligent GitHub API usage

### **Performance Metrics**
| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| **Rule Toggle** | 200-300ms | 5-10ms | **30x faster** |
| **UI Refresh** | 100ms | 0ms | **Instant** |
| **File Cleanup** | Partial | Complete | **100% reliable** |
| **Multi-clicks** | Cumulative latency | No latency | **Fluid** |

## 🔄 Migration Guide

### **From Legacy .cursorrules to Project Rules**

The extension automatically migrates to the modern `.cursor/rules/` format:

| Aspect | Legacy | Modern |
|--------|--------|--------|
| **Location** | `.cursorrules` | `.cursor/rules/` |
| **Format** | Plain text | MDC (Markdown + YAML) |
| **Organization** | Single combined file | One file per rule |
| **Performance** | Slower | Optimized |
| **Status** | ⚠️ Deprecated | ✅ Recommended |

**No action required** - the extension handles migration automatically!

## 🐛 Troubleshooting

### **Common Issues**

#### **Rules Not Applied in Cursor**
```bash
# Check files are created
find . -name "*.mdc" -path "*/.cursor/rules/*"

# Verify YAML format
head -10 .cursor/rules/your-rule.mdc

# Restart Cursor after activating new rules
```

#### **Extension Performance Issues**
- Clear database: Settings → SolidRules → Clear Database
- Reset GitHub token if rate limited
- Check VSCode developer console for errors

#### **GitHub Rate Limits**
- Configure GitHub token for 5000 requests/hour
- Without token: 60 requests/hour limit
- Extension shows warnings when approaching limits

### **Debug Commands**
```bash
# Manual workspace sync
Ctrl+Shift+P → "SolidRules: Sync Workspace Files"

# Clear all data
Ctrl+Shift+P → "SolidRules: Clear Database"

# Configure GitHub token
Ctrl+Shift+P → "SolidRules: Configure GitHub Token"
```

## 🤝 Contributing

We welcome contributions! 

### **Ways to Contribute**
- 🐛 Report bugs and issues
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit pull requests
- ⭐ Star the repository

### **Development Workflow**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules)**: Amazing collection of cursor rules
- **VSCode Team**: Excellent extension API and documentation
- **Cursor AI**: Revolutionary AI-powered code editor
- **Community**: All contributors and users who helped optimize performance

## 📞 Support

### **Getting Help**
- 📖 **Documentation**: This comprehensive README
- 💬 **Discussions**: GitHub Discussions for questions
- 🐛 **Issues**: GitHub Issues for bugs and feature requests
- 📧 **Email**: support@solidrules.dev

### **Performance Notes**
- Extension uses VSCode native storage (no SQLite3 dependencies)
- Ultra-fast rule toggling with background synchronization
- Optimized for rapid rule selection and workspace management
- Smart GitHub API usage with rate limit protection

---

**SolidRules provides the fastest, most intuitive way to manage Cursor rules with zero-latency interactions and intelligent background synchronization!** 🚀 