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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
    <title>Setup GitHub Token</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 0;
            margin: 0;
            height: 100vh;
            overflow-y: auto;
        }
        
        .container {
            max-width: 480px;
            margin: 0 auto;
            padding: 32px 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 100vh;
        }
        
        .header {
            text-align: center;
            margin-bottom: 32px;
        }
        
        .header h1 {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .header p {
            margin: 0;
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.5;
        }
        
        .card {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
        }
        
        .benefit-box {
            background: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-textLink-foreground);
            border-radius: 6px;
            padding: 12px 16px;
            margin: 16px 0;
        }
        
        .benefit-box .title {
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 4px;
        }
        
        .benefit-box .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            font-size: 13px;
            color: var(--vscode-foreground);
        }
        
        .form-input {
            width: 100%;
            padding: 10px 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            transition: border-color 0.15s ease;
        }
        
        .form-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            text-decoration: none;
            width: 100%;
            margin-bottom: 12px;
        }
        
        .btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-button-background);
        }
        
        .btn.primary:hover {
            background: var(--vscode-button-hoverBackground);
            border-color: var(--vscode-button-hoverBackground);
        }
        
        .btn.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .instructions {
            margin-top: 24px;
        }
        
        .instructions-title {
            font-weight: 600;
            margin-bottom: 12px;
            font-size: 14px;
        }
        
        .instructions-list {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            line-height: 1.6;
            padding-left: 16px;
            margin: 0;
        }
        
        .instructions-list li {
            margin-bottom: 6px;
        }
        
        .divider {
            height: 1px;
            background: var(--vscode-panel-border);
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Setup GitHub Token</h1>
            <p>Configure your GitHub token for enhanced rate limits</p>
        </div>

        <div class="card">
            <div class="benefit-box">
                <div class="title">Rate Limit Boost</div>
                <div class="description">Increase from 60 to 5,000 requests per hour (free)</div>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="tokenInput">GitHub Personal Access Token</label>
                <input 
                    type="password" 
                    id="tokenInput" 
                    class="form-input"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                />
            </div>
            
            <button class="btn secondary" id="githubButton">
                Create GitHub Token
            </button>
            
            <div class="divider"></div>
            
            <button class="btn primary" id="saveButton">
                Configure SolidRules
            </button>
        </div>

        <div class="instructions">
            <div class="instructions-title">Setup Instructions</div>
            <ol class="instructions-list">
                <li>Click "Create GitHub Token" to open GitHub</li>
                <li>Sign in to your GitHub account</li>
                <li>Set token name to "SolidRules"</li>
                <li>Select "public_repo" permission</li>
                <li>Click "Generate token"</li>
                <li>Copy and paste the token above</li>
            </ol>
        </div>
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
                // Better error handling
                const input = document.getElementById('tokenInput');
                input.style.borderColor = 'var(--vscode-errorForeground)';
                setTimeout(() => {
                    input.style.borderColor = 'var(--vscode-input-border)';
                }, 2000);
            }
        }
        
        function openGitHub() {
            vscode.postMessage({
                command: 'openGitHub'
            });
        }

        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('tokenInput').focus();
            
            document.getElementById('githubButton').addEventListener('click', openGitHub);
            document.getElementById('saveButton').addEventListener('click', saveToken);
            
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