import * as vscode from 'vscode';
import { RulesManager } from '../managers/RulesManager';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'solidrules.settings';
    
    constructor(
        private _context: vscode.ExtensionContext,
        private _rulesManager?: RulesManager
    ) {}

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                console.log('Settings message received:', message);
                switch (message.command) {
                    case 'configureToken':
                        await vscode.commands.executeCommand('solidrules.configureGitHubToken');
                        break;

                    case 'resetToken':
                        await vscode.commands.executeCommand('solidrules.resetGitHubToken');
                        break;

                    case 'clearDatabase':
                        await vscode.commands.executeCommand('solidrules.clearDatabase');
                        break;

                    case 'syncWorkspace':
                        await vscode.commands.executeCommand('solidrules.syncWorkspace');
                        break;

                    case 'exportRules':
                        await vscode.commands.executeCommand('solidrules.exportRules');
                        break;

                    case 'openExtensionSettings':
                        await vscode.commands.executeCommand('workbench.action.openSettings', 'solidrules');
                        break;

                    case 'openGitHub':
                        const githubUrl = 'https://github.com/settings/tokens/new?scopes=public_repo&description=SolidRules%20VSCode%20Extension';
                        await vscode.env.openExternal(vscode.Uri.parse(githubUrl));
                        break;
                }
            }
        );
    }

    private async _getTokenStatus(): Promise<{ hasToken: boolean; tokenPreview?: string }> {
        try {
            if (this._rulesManager) {
                const githubService = this._rulesManager.getGitHubService();
                const token = await githubService.getSecureToken();
                const hasToken = !!token;
                
                // Create safe token preview (first 8 chars + ...)
                const result: { hasToken: boolean; tokenPreview?: string } = { hasToken };
                if (token) {
                    result.tokenPreview = `${token.substring(0, 8)}...`;
                }
                
                return result;
            }
            return { hasToken: false };
        } catch (error) {
            console.error('Error getting token status:', error);
            return { hasToken: false };
        }
    }

    private async _getHtmlForWebview(webview: vscode.Webview) {
        const tokenStatus = await this._getTokenStatus();
        return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
    <title>SolidRules Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 16px;
            margin: 0;
            line-height: 1.4;
        }
        
        .header {
            text-align: center;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--vscode-input-border);
            padding-bottom: 16px;
        }
        
        .header h1 {
            color: var(--vscode-foreground);
            margin: 0 0 8px 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .header p {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin: 0;
        }
        
        .section {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 16px;
        }
        
        .section h3 {
            margin: 0 0 12px 0;
            color: var(--vscode-foreground);
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .section h3 .icon {
            font-size: 16px;
        }
        
        .section-description {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-bottom: 12px;
            line-height: 1.4;
        }
        
        .action-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            font-weight: 500;
            width: 100%;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .action-button.secondary {
            background-color: transparent;
            color: var(--vscode-textLink-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        
        .action-button.secondary:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .action-button.danger {
            background-color: var(--vscode-errorForeground);
            color: var(--vscode-editor-background);
        }
        
        .action-button.danger:hover {
            background-color: var(--vscode-errorForeground);
            opacity: 0.9;
        }
        
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-badge.active {
            background-color: var(--vscode-charts-green);
            color: var(--vscode-editor-background);
        }
        
        .status-badge.inactive {
            background-color: var(--vscode-charts-orange);
            color: var(--vscode-editor-background);
        }
        
        .divider {
            border-top: 1px solid var(--vscode-input-border);
            margin: 20px 0;
        }
        
        .version-info {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid var(--vscode-input-border);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚙️ SolidRules Settings</h1>
        <p>Configuration et paramètres avancés</p>
    </div>

    <div class="section">
                 <h3>
             <span class="icon">🔑</span>
             GitHub Token
             <span class="status-badge ${tokenStatus.hasToken ? 'active' : 'inactive'}" id="tokenStatus">
                 ${tokenStatus.hasToken ? 'Configuré' : 'Non configuré'}
             </span>
         </h3>
                 <div class="section-description">
             Gérez votre token GitHub pour des limites de taux plus élevées (5000 req/h au lieu de 60).
             ${tokenStatus.hasToken && tokenStatus.tokenPreview ? `<br><small>Token actuel: <code>${tokenStatus.tokenPreview}</code></small>` : ''}
         </div>
        
        <button class="action-button secondary" id="configureTokenBtn">
            🔧 Configurer le Token
        </button>
        
        <button class="action-button secondary" id="createTokenBtn">
            🆕 Créer un Token GitHub
        </button>
        
        <div class="divider"></div>
        
        <button class="action-button danger" id="resetTokenBtn">
            🗑️ Réinitialiser le Token
        </button>
    </div>

    <div class="section">
        <h3>
            <span class="icon">💾</span>
            Base de Données
        </h3>
        <div class="section-description">
            Gérez les données locales de SolidRules. Attention : ces actions sont irréversibles.
        </div>
        
        <button class="action-button secondary" id="syncWorkspaceBtn">
            🔄 Synchroniser le Workspace
        </button>
        
        <button class="action-button secondary" id="exportRulesBtn">
            📤 Exporter les Règles
        </button>
        
        <div class="divider"></div>
        
        <button class="action-button danger" id="clearDatabaseBtn">
            🗑️ Vider la Base de Données
        </button>
    </div>

    <div class="section">
        <h3>
            <span class="icon">🛠️</span>
            Extension VSCode
        </h3>
        <div class="section-description">
            Paramètres de l'extension et configuration VSCode.
        </div>
        
        <button class="action-button secondary" id="extensionSettingsBtn">
            ⚙️ Ouvrir les Paramètres
        </button>
    </div>

    <div class="version-info">
        SolidRules Extension v1.0.0<br>
        Gestionnaire de règles CursorRules
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Action handlers
        document.getElementById('configureTokenBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'configureToken' });
        });
        
        document.getElementById('createTokenBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'openGitHub' });
        });
        
        document.getElementById('resetTokenBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'resetToken' });
        });
        
        document.getElementById('syncWorkspaceBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'syncWorkspace' });
        });
        
        document.getElementById('exportRulesBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'exportRules' });
        });
        
        document.getElementById('clearDatabaseBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'clearDatabase' });
        });
        
        document.getElementById('extensionSettingsBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'openExtensionSettings' });
        });
    </script>
</body>
</html>`;
    }
} 