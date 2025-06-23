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
                    case 'return':
                        await vscode.commands.executeCommand('solidrules.closeSettings');
                        break;

                    case 'refreshRules':
                        await vscode.commands.executeCommand('solidrules.refreshRules');
                        break;

                    case 'searchRules':
                        await vscode.commands.executeCommand('solidrules.searchRules');
                        break;

                    case 'importCustomRule':
                        await vscode.commands.executeCommand('solidrules.importCustomRule');
                        break;

                    case 'configureGitHubToken':
                        await vscode.commands.executeCommand('solidrules.configureGitHubToken');
                        break;

                    case 'resetGitHubToken':
                        await vscode.commands.executeCommand('solidrules.resetGitHubToken');
                        break;

                    case 'clearDatabase':
                        await vscode.commands.executeCommand('solidrules.clearDatabase');
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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
    <title>Settings</title>
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
        
        .header {
            position: sticky;
            top: 0;
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 100;
        }
        
        .return-btn {
            background: none;
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-foreground);
            padding: 6px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
        }
        
        .return-btn:hover {
            background-color: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .header h1 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .content {
            padding: 20px;
            max-width: 600px;
        }
        
        .setting-group {
            margin-bottom: 32px;
        }
        
        .setting-group:last-child {
            margin-bottom: 0;
        }
        
        .setting-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin: 0 0 8px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .setting-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 16px;
            line-height: 1.4;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: center;
            width: auto;
            margin-right: 8px;
            margin-bottom: 8px;
        }
        
        .btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .btn.danger {
            background: #da3633;
            color: #ffffff;
            border-color: #da3633;
        }
        
        .btn.danger:hover {
            background: #b92e2a;
            border-color: #b92e2a;
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
        
        .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        
        .status-badge.success {
            background: #2ea043;
            color: #ffffff;
        }
        
        .status-badge.warning {
            background: #fb8500;
            color: #ffffff;
        }
        
        .token-preview {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--vscode-textPreformat-foreground);
            background: var(--vscode-textBlockQuote-background);
            padding: 4px 8px;
            border-radius: 4px;
            margin-top: 8px;
            display: inline-block;
        }
        
        .divider {
            height: 1px;
            background: var(--vscode-panel-border);
            margin: 16px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <button class="return-btn" id="returnBtn">
            <span>←</span>
            Return
        </button>
        <h1>Settings</h1>
    </div>

    <div class="content">
        <div class="setting-group">
            <div class="setting-title">
                Refresh Rules
                <span class="status-badge">Quick Action</span>
            </div>
            <div class="setting-description">Update rules from GitHub repository</div>
            <button class="btn primary" id="refreshRulesBtn">Refresh Rules</button>
        </div>

        <div class="setting-group">
            <div class="setting-title">
                Search Rules
                <span class="status-badge">Quick Action</span>
            </div>
            <div class="setting-description">Search through available rules</div>
            <button class="btn primary" id="searchRulesBtn">Search Rules</button>
        </div>

        <div class="setting-group">
            <div class="setting-title">
                Import Custom Rule
                <span class="status-badge">Quick Action</span>
            </div>
            <div class="setting-description">Import your own custom rule</div>
            <button class="btn primary" id="importCustomRuleBtn">Import Custom Rule</button>
        </div>

        <div class="setting-group">
            <div class="setting-title">
                GitHub Token
                <span class="status-badge ${tokenStatus.hasToken ? 'success' : 'warning'}">
                    ${tokenStatus.hasToken ? 'Configured' : 'Not configured'}
                </span>
            </div>
            <div class="setting-description">
                Configure GitHub token for higher rate limits (5000 req/h instead of 60)
                ${tokenStatus.hasToken && tokenStatus.tokenPreview ? `<div class="token-preview">${tokenStatus.tokenPreview}</div>` : ''}
            </div>
            <button class="btn" id="configureGitHubTokenBtn">Configure GitHub Token</button>
            <button class="btn danger" id="resetGitHubTokenBtn">Reset GitHub Token</button>
        </div>

        <div class="divider"></div>

        <div class="setting-group">
            <div class="setting-title">Clear Database</div>
            <div class="setting-description">Remove all rules and data. This action cannot be undone.</div>
            <button class="btn danger" id="clearDatabaseBtn">Clear Database</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('returnBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'return' });
        });
        
        document.getElementById('refreshRulesBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'refreshRules' });
        });
        
        document.getElementById('searchRulesBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'searchRules' });
        });
        
        document.getElementById('importCustomRuleBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'importCustomRule' });
        });
        
        document.getElementById('configureGitHubTokenBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'configureGitHubToken' });
        });
        
        document.getElementById('resetGitHubTokenBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'resetGitHubToken' });
        });
        
        document.getElementById('clearDatabaseBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'clearDatabase' });
        });
    </script>
</body>
</html>`;
    }
} 