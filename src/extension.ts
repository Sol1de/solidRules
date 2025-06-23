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
        console.log('🚀 Activating SolidRules extension...');
        
        // Initialize core services with proper dependency injection
        const databaseManager = new DatabaseManager(context);
        const githubService = new GitHubService(context); // Pass context for secure token storage
        const notificationManager = new NotificationManager();
        const workspaceManager = new WorkspaceManager();
        
        // Initialize rules manager with all dependencies
        rulesManager = new RulesManager(
            databaseManager,
            githubService,
            notificationManager,
            workspaceManager
        );
        
        // Check token configuration using secure storage
        const hasToken = !!(await githubService.getSecureToken());
        await vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', hasToken);
        console.log(`🔒 Token configured: ${hasToken ? 'Yes' : 'No'}`);

        // Register providers with proper error handling
        const rulesExplorerProvider = new RulesExplorerProvider(rulesManager);
        const activeRulesProvider = new ActiveRulesProvider(rulesManager);
        const favoritesProvider = new FavoritesProvider(rulesManager);
        const tokenSetupProvider = new TokenSetupViewProvider(context);
        const activeRuleDecorator = new ActiveRuleDecorator();
        
        // Register tree data providers with error handling
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('solidrules.rulesExplorer', rulesExplorerProvider),
            vscode.window.registerTreeDataProvider('solidrules.activeRules', activeRulesProvider),
            vscode.window.registerTreeDataProvider('solidrules.favorites', favoritesProvider)
        );
        
        // Register file decoration provider for visual styling
        context.subscriptions.push(
            vscode.window.registerFileDecorationProvider(activeRuleDecorator)
        );
        
        // Register webview view provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(TokenSetupViewProvider.viewType, tokenSetupProvider)
        );
        
        console.log('✅ TokenSetupViewProvider registered with viewType:', TokenSetupViewProvider.viewType);
        
        // Initialize command manager with proper error handling
        commandManager = new CommandManager(
            rulesManager,
            rulesExplorerProvider
        );
        
        // Register all commands
        commandManager.registerCommands(context);
        
        // Initialize database and sync rules with proper error handling
        await databaseManager.initialize();
        console.log('✅ Database initialized');
        
        await rulesManager.initializeRules();
        console.log('✅ Rules initialized');
        
        // Schedule initial workspace sync after extension loads with error handling
        setTimeout(async () => {
            try {
                console.log('🚀 Starting initial workspace sync...');
                await rulesManager.syncWorkspaceFiles();
                console.log('✅ Initial workspace sync completed successfully');
            } catch (error) {
                console.error('❌ Initial workspace sync failed:', error);
                // Don't show error to user for background sync failure
            }
        }, 1000); // 1 second delay to let extension fully load
        
        // Register workspace sync on window close with enhanced error handling
        context.subscriptions.push(
            vscode.workspace.onWillSaveTextDocument(async () => {
                // Trigger sync when user saves files (indicates active work)
                try {
                    await rulesManager.syncWorkspaceFiles();
                } catch (error) {
                    console.error('❌ Workspace sync on save failed:', error);
                    // Silent failure for background sync
                }
            })
        );
        
        console.log('✅ SolidRules extension activated successfully');
        
    } catch (error) {
        console.error('❌ Failed to activate SolidRules extension:', error);
        vscode.window.showErrorMessage(`SolidRules activation failed: ${error}`);
        throw error; // Re-throw to ensure proper error reporting
    }
}

export function deactivate() {
    try {
        console.log('🛑 Deactivating SolidRules extension...');
        
        // Cleanup resources
        if (commandManager) {
            commandManager.dispose();
        }
        
        if (rulesManager) {
            rulesManager.dispose();
        }
        
        console.log('✅ SolidRules extension deactivated successfully');
    } catch (error) {
        console.error('❌ Error during SolidRules deactivation:', error);
    }
} 