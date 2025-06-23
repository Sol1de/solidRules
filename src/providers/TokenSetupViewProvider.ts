import * as vscode from 'vscode';

export class TokenSetupViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'solidrules.tokenSetup';

    constructor(private readonly _context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                console.log('Message received from webview:', message);
                switch (message.command) {
                    case 'saveToken':
                        if (message.token && message.token.trim()) {
                            await this._saveToken(message.token.trim());
                            
                            // Update VSCode context to show that token is configured
                            await vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', true);
                            console.log('🔒 Token configured: Yes');
                            
                            vscode.window.showInformationMessage('Token GitHub configuré avec succès !');
                            // Refresh the interface
                            vscode.commands.executeCommand('solidrules.refreshRules');
                        } else {
                            vscode.window.showErrorMessage('Veuillez entrer un token valide.');
                        }
                        break;

                    case 'openGitHub':
                        console.log('openGitHub case triggered');
                        try {
                            const githubUrl = 'https://github.com/settings/tokens/new?scopes=public_repo&description=SolidRules%20VSCode%20Extension';
                            console.log('Opening URL:', githubUrl);
                            await vscode.env.openExternal(vscode.Uri.parse(githubUrl));
                            vscode.window.showInformationMessage('Page GitHub ouverte dans votre navigateur');
                            console.log('GitHub page opened successfully');
                        } catch (error) {
                            console.error('Error opening GitHub:', error);
                            vscode.window.showErrorMessage(`Impossible d'ouvrir GitHub: ${error}`);
                            vscode.window.showInformationMessage('Copiez cette URL dans votre navigateur: https://github.com/settings/tokens/new?scopes=public_repo&description=SolidRules%20VSCode%20Extension');
                        }
                        break;
                }
            }
        );
    }

    private async _saveToken(token: string): Promise<void> {
        try {
            // Use SecretStorage API for secure token storage (consistent with GitHubService)
            const TOKEN_SECRET_KEY = 'solidrules.github.token';
            await this._context.secrets.store(TOKEN_SECRET_KEY, token);
            console.log('✅ GitHub token stored securely via TokenSetupViewProvider');
            
            // Clear any old token from VSCode configuration (migration cleanup)
            const config = vscode.workspace.getConfiguration('solidrules');
            const oldToken = config.get<string>('githubToken');
            if (oldToken) {
                await config.update('githubToken', undefined, vscode.ConfigurationTarget.Global);
                console.log('🧹 Cleaned up old token from VSCode configuration');
            }
        } catch (error) {
            console.error('❌ Failed to store token in TokenSetupViewProvider:', error);
            throw error;
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
    <title>Configuration SolidRules</title>
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
        }
        
        .benefit {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 8px 12px;
            margin: 12px 0;
            border-radius: 0 3px 3px 0;
            font-size: 12px;
        }
        
        .input-group {
            margin: 12px 0;
        }
        
        .input-group label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            font-size: 12px;
        }
        
        .input-group input {
            width: 100%;
            padding: 8px 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            box-sizing: border-box;
        }
        
        .input-group input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            font-weight: 500;
            width: 100%;
            margin-bottom: 8px;
        }
        
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .button.secondary {
            background-color: transparent;
            color: var(--vscode-textLink-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        
        .button.secondary:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .instructions {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.4;
        }
        
        .instructions ol {
            padding-left: 16px;
            margin: 8px 0;
        }
        
        .instructions li {
            margin-bottom: 4px;
        }
        
        .actions {
            margin-top: 16px;
        }
        
        .github-link {
            margin: 12px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Configuration SolidRules</h1>
        <p>Gestionnaire de règles CursorRules</p>
    </div>

    <div class="section">
        <h3>Token GitHub</h3>
        <div class="benefit">
            <strong>Avantage :</strong> 60 → 5000 req/h (gratuit)
        </div>
        
        <div class="input-group">
            <label for="tokenInput">Votre token :</label>
            <input type="password" id="tokenInput" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
        </div>
        
        <div class="github-link">
            <button class="button secondary" id="githubButton">
                Créer un token GitHub
            </button>
        </div>
    </div>

    <div class="section">
        <h3>Instructions</h3>
        <div class="instructions">
            <ol>
                <li>Cliquez "Créer un token GitHub"</li>
                <li>Connectez-vous à GitHub</li>
                <li>Nom : "SolidRules"</li>
                <li>Cochez "public_repo"</li>
                <li>Cliquez "Generate token"</li>
                <li>Copiez et collez le token</li>
            </ol>
        </div>
    </div>

    <div class="actions">
        <button class="button" id="saveButton">
            Configurer SolidRules
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function saveToken() {
            const token = document.getElementById('tokenInput').value;
            if (token.trim()) {
                vscode.postMessage({
                    command: 'saveToken',
                    token: token
                });
            } else {
                alert('Veuillez entrer un token valide.');
            }
        }
        
        function openGitHub() {
            console.log('openGitHub function called');
            vscode.postMessage({
                command: 'openGitHub'
            });
            console.log('Message sent to VSCode');
        }
        


        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {
            // Focus on input when loaded
            document.getElementById('tokenInput').focus();
            
            // GitHub button
            document.getElementById('githubButton').addEventListener('click', openGitHub);
            
            // Save button
            document.getElementById('saveButton').addEventListener('click', saveToken);
            
            // Allow Enter key to save token
            document.getElementById('tokenInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    saveToken();
                }
            });
        });
    </script>
</body>
</html>`;
    }
} 