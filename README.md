# SolidRules - VSCode Extension

**Professional Visual CursorRules Manager for AI-powered Development**

SolidRules is a powerful VSCode extension that provides a visual and intuitive way to manage CursorRules from the [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) repository. Designed specifically for AI-powered development with Cursor IDE and other AI code editors.

## 🚀 Features

### **Visual Rule Management**
- **Tree View Explorer**: Browse rules organized by categories and technologies
- **Search & Filter**: Advanced search with technology and category filters
- **Favorites System**: Save frequently used rules for quick access
- **Preview Mode**: View rule content before activation

### **Multi-Workspace Support**
- **Workspace-Specific Rules**: Each workspace maintains its own active rules
- **Rule Directory Management**: Organized storage in `cursorRules/` folder
- **Master File Generation**: Automatic `.cursorrules` file creation and updates

### **Smart Rule Activation**
- **One-Click Activation**: Instantly apply rules to your workspace
- **Multiple Rule Support**: Combine multiple rules intelligently
- **Conflict Resolution**: Automatic rule merging and organization

### **Auto-Update System**
- **GitHub Sync**: Automatic synchronization with the latest rules
- **Update Notifications**: Smart notifications for rule updates
- **Version Tracking**: Keep track of rule versions and changes

### **Custom Rules Support**
- **Import Custom Rules**: Add your own .cursorrules files
- **Technology Tagging**: Organize custom rules with technologies and tags
- **Export Functionality**: Share rule collections easily

## 📋 Requirements

- **VSCode**: Version 1.85.0 or higher
- **Node.js**: Version 16 or higher (for development)
- **Internet Connection**: Required for fetching rules from GitHub

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

### 2. **Browse Rules**
- Explore rules organized by categories (Frontend, Backend, Mobile, etc.)
- Use the search box to find specific rules
- Filter by technology or category using the filter buttons

### 3. **Activate Rules**
- Right-click on any rule and select "Activate Rule"
- Or double-click to preview, then activate from the preview
- Check the "Active Rules" section to see currently active rules

### 4. **Workspace Integration**
- Active rules are automatically written to your workspace
- Find individual rule files in the `cursorRules/` directory
- The main `.cursorrules` file combines all active rules

## 📚 Usage Guide

### **Managing Rules**

#### **Search and Filter**
```bash
# Search by name, technology, or content
Search: "react typescript"

# Filter by technology
Filter → Technology → React

# Filter by category
Filter → Category → Frontend
```

#### **Rule Activation**
1. **Single Rule**: Right-click → Activate Rule
2. **Multiple Rules**: Activate several rules to combine them
3. **Preview First**: Double-click to preview content

#### **Favorites Management**
- **Add to Favorites**: Right-click → Add to Favorites
- **Quick Access**: Use the Favorites panel
- **Remove**: Right-click in Favorites → Remove from Favorites

### **Workspace Features**

#### **File Structure**
```
your-project/
├── .cursorrules              # Master file (auto-generated)
├── cursorRules/              # Rules directory
│   ├── react-typescript.cursorrules
│   ├── tailwind-css.cursorrules
│   └── custom-rule.cursorrules
└── ...
```

#### **Custom Rules**
1. Click the "+" button in Rules Explorer
2. Enter rule name and select file
3. Add technologies and tags
4. Rule is imported and ready to use

### **Update Management**
- **Auto-Check**: Updates checked on startup
- **Manual Refresh**: Click refresh button in Rules Explorer
- **Notification System**: 
  - Single rule updates: Individual notifications
  - Multiple updates: Grouped notification with bulk update option

## ⚙️ Configuration

### **Extension Settings**
```json
{
  "solidrules.autoRefresh": false,           // Auto-refresh on startup
  "solidrules.refreshInterval": 24,          // Refresh interval (hours)
  "solidrules.rulesDirectory": "cursorRules", // Rules directory name
  "solidrules.enableNotifications": true,    // Enable update notifications
  "solidrules.defaultSortOrder": "recent"    // Default sort order
}
```

### **Access Settings**
- Command Palette: `SolidRules: Settings`
- Or: File → Preferences → Settings → Extensions → SolidRules

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

### **Project Structure**
```
src/
├── extension.ts              # Main extension entry point
├── types/                    # TypeScript type definitions
├── managers/                 # Core business logic
│   ├── RulesManager.ts       # Rules management
│   ├── DatabaseManager.ts    # Local database
│   ├── WorkspaceManager.ts   # Workspace operations
│   └── CommandManager.ts     # VSCode commands
├── providers/                # Tree view providers
│   ├── RulesExplorerProvider.ts
│   ├── ActiveRulesProvider.ts
│   └── FavoritesProvider.ts
└── services/                 # External services
    └── GitHubService.ts      # GitHub API integration
```

### **Build and Test**
```bash
# Build for production
npm run build

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Debug in VSCode
Press F5 or use "Run Extension" launch configuration
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

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
- **Community**: All contributors and users

## 📞 Support

### **Getting Help**
- 📖 **Documentation**: Check this README and inline help
- 💬 **Discussions**: GitHub Discussions for questions
- 🐛 **Issues**: GitHub Issues for bugs and feature requests
- 📧 **Email**: support@solidrules.dev

### **Common Issues**
- **Rules not syncing**: Check internet connection and GitHub access
- **Workspace not updating**: Ensure proper workspace permissions
- **Performance issues**: Try clearing the database (settings → reset)

## 🗺 Roadmap

### **Version 1.0 (Current)**
- ✅ Basic rule management
- ✅ GitHub synchronization
- ✅ Multi-workspace support
- ✅ Custom rules import

### **Version 1.1 (Planned)**
- 🔄 Rule templates and snippets
- 🔄 Advanced filtering options
- 🔄 Rule conflict detection
- 🔄 Performance optimizations

### **Version 2.0 (Future)**
- 🔮 AI-powered rule suggestions
- 🔮 Team collaboration features
- 🔮 Cloud synchronization
- 🔮 Advanced analytics

---

**Made with ❤️ by the SolidRules Team**

*Empower your AI-driven development workflow with intelligent rule management.*

## 🚀 Quick Setup

### GitHub Rate Limits
By default, GitHub API allows 60 requests/hour. For better experience:

**🔑 Add GitHub Token (FREE & Recommended):**
1. Click the key icon (🔑) in Rules Explorer
2. Follow the guided setup to create a free GitHub token
3. Increase rate limit from 60 to **5000 requests/hour**

### Creating GitHub Token
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Add note: "SolidRules VSCode Extension"
4. Select scope: **"public_repo"** (read access only)
5. Generate and copy the token
6. Paste it in VSCode when prompted 