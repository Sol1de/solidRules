import * as vscode from 'vscode';
import { RulesManager } from './managers/RulesManager';
import { DatabaseManager } from './managers/DatabaseManager';
import { GitHubService } from './services/GitHubService';
import { WorkspaceManager } from './managers/WorkspaceManager';
import { RulesExplorerProvider } from './providers/RulesExplorerProvider';
import { ActiveRulesProvider } from './providers/ActiveRulesProvider';
import { FavoritesProvider } from './providers/FavoritesProvider';
import { TokenSetupViewProvider } from './providers/TokenSetupViewProvider';
import { CommandManager } from './managers/CommandManager';
import { NotificationManager } from './managers/NotificationManager';
import { WorkspaceManager as WorkspaceManagerClass } from './managers/WorkspaceManager';

let rulesManager: RulesManager;
let commandManager: CommandManager;

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize core services
        const databaseManager = new DatabaseManager(context);
        const githubService = new GitHubService();
        const notificationManager = new NotificationManager();
        const workspaceManager = new WorkspaceManagerClass();
        
        // Initialize rules manager
        rulesManager = new RulesManager(
            databaseManager,
            githubService,
            notificationManager,
            workspaceManager
        );
        
        // Initialize context for token configuration
        const config = vscode.workspace.getConfiguration('solidrules');
        const hasToken = !!config.get('githubToken');
        vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', hasToken);

        // Register providers
        const rulesExplorerProvider = new RulesExplorerProvider(rulesManager);
        const activeRulesProvider = new ActiveRulesProvider(rulesManager);
        const favoritesProvider = new FavoritesProvider(rulesManager);
        const tokenSetupProvider = new TokenSetupViewProvider(context);
        
        // Register tree data providers
        vscode.window.registerTreeDataProvider('solidrules.rulesExplorer', rulesExplorerProvider);
        vscode.window.registerTreeDataProvider('solidrules.activeRules', activeRulesProvider);
        vscode.window.registerTreeDataProvider('solidrules.favorites', favoritesProvider);
        
        // Register webview view provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(TokenSetupViewProvider.viewType, tokenSetupProvider)
        );
        
        console.log('TokenSetupViewProvider registered with viewType:', TokenSetupViewProvider.viewType);
        console.log('Token configured:', hasToken);
        
        // Initialize command manager
        commandManager = new CommandManager(
            rulesManager,
            rulesExplorerProvider,
            activeRulesProvider,
            favoritesProvider
        );
        
        // Register all commands
        commandManager.registerCommands(context);
        
        // Initialize database and sync rules
        await databaseManager.initialize();
        await rulesManager.initializeRules();
        
        console.log('SolidRules extension activated successfully');
        
    } catch (error) {
        console.error('Failed to activate SolidRules extension:', error);
        vscode.window.showErrorMessage(`SolidRules activation failed: ${error}`);
    }
}

export function deactivate() {
    console.log('SolidRules extension deactivated');
} 