import * as vscode from 'vscode';
import { RulesManager } from './managers/RulesManager';
import { DatabaseManager } from './managers/DatabaseManager';
import { GitHubService } from './services/GitHubService';
import { RulesExplorerProvider } from './providers/RulesExplorerProvider';
import { ActiveRulesProvider } from './providers/ActiveRulesProvider';
import { FavoritesProvider } from './providers/FavoritesProvider';
import { TokenSetupViewProvider } from './providers/TokenSetupViewProvider';
import { CommandManager } from './managers/CommandManager';
import { NotificationManager } from './managers/NotificationManager';
import { WorkspaceManager } from './managers/WorkspaceManager';
import { ActiveRuleDecorator } from './decorators/ActiveRuleDecorator';

let rulesManager: RulesManager;
let commandManager: CommandManager;

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize core services
        const databaseManager = new DatabaseManager(context);
        const githubService = new GitHubService();
        const notificationManager = new NotificationManager();
        const workspaceManager = new WorkspaceManager();
        
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
        const activeRuleDecorator = new ActiveRuleDecorator();
        
        // Register tree data providers
        vscode.window.registerTreeDataProvider('solidrules.rulesExplorer', rulesExplorerProvider);
        vscode.window.registerTreeDataProvider('solidrules.activeRules', activeRulesProvider);
        vscode.window.registerTreeDataProvider('solidrules.favorites', favoritesProvider);
        
        // Register file decoration provider for visual styling
        context.subscriptions.push(
            vscode.window.registerFileDecorationProvider(activeRuleDecorator)
        );
        
        // Register webview view provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(TokenSetupViewProvider.viewType, tokenSetupProvider)
        );
        
        console.log('TokenSetupViewProvider registered with viewType:', TokenSetupViewProvider.viewType);
        console.log('Token configured:', hasToken);
        
        // Initialize command manager
        commandManager = new CommandManager(
            rulesManager,
            rulesExplorerProvider
        );
        
        // Register all commands
        commandManager.registerCommands(context);
        
        // Initialize database and sync rules
        await databaseManager.initialize();
        await rulesManager.initializeRules();
        
        // Schedule initial workspace sync after extension loads
        setTimeout(async () => {
            try {
                console.log('🚀 Initial workspace sync...');
                await rulesManager.syncWorkspaceFiles();
                console.log('✅ Initial workspace sync completed');
            } catch (error) {
                console.error('Initial workspace sync failed:', error);
            }
        }, 1000); // 1 second delay to let extension fully load
        
        // Register workspace sync on window close
        context.subscriptions.push(
            vscode.workspace.onWillSaveTextDocument(async () => {
                // Trigger sync when user saves files (indicates active work)
                try {
                    await rulesManager.syncWorkspaceFiles();
                } catch (error) {
                    console.error('Workspace sync on save failed:', error);
                }
            })
        );
        
        console.log('SolidRules extension activated successfully');
        
    } catch (error) {
        console.error('Failed to activate SolidRules extension:', error);
        vscode.window.showErrorMessage(`SolidRules activation failed: ${error}`);
    }
}

export function deactivate() {
    console.log('SolidRules extension deactivated');
} 