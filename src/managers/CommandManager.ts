import * as vscode from 'vscode';
import { RulesManager } from './RulesManager';
import { RulesExplorerProvider } from '../providers/RulesExplorerProvider';

export class CommandManager {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private rulesManager: RulesManager,
        private rulesExplorerProvider: RulesExplorerProvider
    ) {}

    registerCommands(context: vscode.ExtensionContext): void {
        // Register all commands with enhanced error handling
        this.disposables.push(
            vscode.commands.registerCommand('solidrules.refreshRules', () => this.handleCommand('refreshRules', () => this.refreshRules())),
            vscode.commands.registerCommand('solidrules.searchRules', () => this.handleCommand('searchRules', () => this.searchRules())),
            vscode.commands.registerCommand('solidrules.activateRule', (ruleId: string) => this.handleCommand('activateRule', () => this.activateRule(ruleId))),
            vscode.commands.registerCommand('solidrules.deactivateRule', (ruleId: string) => this.handleCommand('deactivateRule', () => this.deactivateRule(ruleId))),
            vscode.commands.registerCommand('solidrules.toggleRule', (ruleId: string) => this.handleCommand('toggleRule', () => this.toggleRule(ruleId))),
            vscode.commands.registerCommand('solidrules.bulkToggle', () => this.handleCommand('bulkToggle', () => this.showBulkToggleMenu())),
            vscode.commands.registerCommand('solidrules.deleteRule', (ruleId: string) => this.handleCommand('deleteRule', () => this.deleteRule(ruleId))),
            vscode.commands.registerCommand('solidrules.previewRule', (ruleId: string) => this.handleCommand('previewRule', () => this.previewRule(ruleId))),
            vscode.commands.registerCommand('solidrules.addToFavorites', (ruleId: string) => this.handleCommand('addToFavorites', () => this.addToFavorites(ruleId))),
            vscode.commands.registerCommand('solidrules.removeFromFavorites', (ruleId: string) => this.handleCommand('removeFromFavorites', () => this.removeFromFavorites(ruleId))),
            vscode.commands.registerCommand('solidrules.importCustomRule', () => this.handleCommand('importCustomRule', () => this.importCustomRule())),
            vscode.commands.registerCommand('solidrules.exportRules', () => this.handleCommand('exportRules', () => this.exportRules())),
            vscode.commands.registerCommand('solidrules.openSettings', () => this.handleCommand('openSettings', () => this.openSettings())),
            vscode.commands.registerCommand('solidrules.closeSettings', () => this.handleCommand('closeSettings', () => this.closeSettings())),
            vscode.commands.registerCommand('solidrules.updateRule', (ruleId: string) => this.handleCommand('updateRule', () => this.updateRule(ruleId))),
            vscode.commands.registerCommand('solidrules.updateAllRules', () => this.handleCommand('updateAllRules', () => this.updateAllRules())),
            vscode.commands.registerCommand('solidrules.syncWorkspace', () => this.handleCommand('syncWorkspace', () => this.syncWorkspace())),
            vscode.commands.registerCommand('solidrules.clearFilters', () => this.handleCommand('clearFilters', () => this.clearFilters())),
            vscode.commands.registerCommand('solidrules.filterByTechnology', () => this.handleCommand('filterByTechnology', () => this.filterByTechnology())),
            vscode.commands.registerCommand('solidrules.filterByCategory', () => this.handleCommand('filterByCategory', () => this.filterByCategory())),
            vscode.commands.registerCommand('solidrules.sortRules', () => this.handleCommand('sortRules', () => this.sortRules())),
            vscode.commands.registerCommand('solidrules.configureGitHubToken', () => this.handleCommand('configureGitHubToken', () => this.configureGitHubToken())),
            vscode.commands.registerCommand('solidrules.resetGitHubToken', () => this.handleCommand('resetGitHubToken', () => this.resetGitHubToken())),
            vscode.commands.registerCommand('solidrules.clearDatabase', () => this.handleCommand('clearDatabase', () => this.clearDatabase())),
            vscode.commands.registerCommand('solidrules.skipTokenSetup', () => this.handleCommand('skipTokenSetup', () => this.skipTokenSetup()))
        );

        // Add disposables to context
        context.subscriptions.push(...this.disposables);
    }

    // Standardized error handling wrapper for all commands
    private async handleCommand(commandName: string, operation: () => Promise<void>): Promise<void> {
        try {
            console.log(`🚀 Executing command: ${commandName}`);
            await operation();
            console.log(`✅ Command completed: ${commandName}`);
        } catch (error) {
            console.error(`❌ Command failed: ${commandName}`, error);
            vscode.window.showErrorMessage(`Command failed: ${error}`);
        }
    }

    private async refreshRules(): Promise<void> {
        try {
            // Start refresh asynchronously without blocking UI
            this.rulesManager.refreshRules().catch(error => {
                console.error('Failed to refresh rules:', error);
                vscode.window.showErrorMessage(`Failed to refresh rules: ${error}`);
            });
            
            // Show immediate feedback without waiting
            vscode.window.showInformationMessage('Refreshing rules in background...');
        } catch (error) {
            console.error('Failed to start refresh:', error);
            vscode.window.showErrorMessage(`Failed to start refresh: ${error}`);
        }
    }

    private async searchRules(): Promise<void> {
        try {
            const currentQuery = this.rulesExplorerProvider.getSearchQuery();
            const query = await vscode.window.showInputBox({
                prompt: 'Search rules by name, technology, or content',
                placeHolder: 'Enter search query...',
                value: currentQuery
            });

            if (query !== undefined) {
                await this.rulesExplorerProvider.applySearch(query);
            }
        } catch (error) {
            console.error('Failed to search rules:', error);
        }
    }

    private async activateRule(ruleIdOrTreeItem?: string | any): Promise<void> {
        try {
            let ruleId: string | undefined;
            
            // Handle different argument types
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem?.rule?.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            }
            
            if (!ruleId) {
                // Show quick pick to select rule
                const rules = await this.rulesManager.getAllRules();
                const inactiveRules = rules.filter(r => !r.isActive);
                
                if (inactiveRules.length === 0) {
                    vscode.window.showInformationMessage('All rules are already active');
                    return;
                }

                const quickPickItems = inactiveRules.map((rule, index) => ({
                    label: rule.name,
                    description: `${rule.category} • ${rule.technologies.join(', ')}`,
                    detail: rule.description,
                    ruleIndex: index
                }));

                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: 'Select a rule to activate',
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    ruleId = inactiveRules[selected.ruleIndex].id;
                }
            }

            if (ruleId) {
                await this.rulesManager.activateRule(ruleId);
            }
        } catch (error) {
            console.error('Failed to activate rule:', error);
        }
    }

    private async deactivateRule(ruleIdOrTreeItem?: string | any): Promise<void> {
        try {
            let ruleId: string | undefined;
            
            // Handle different argument types
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem?.rule?.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            }
            
            if (!ruleId) {
                // Show quick pick to select rule
                const activeRules = await this.rulesManager.getActiveRules();
                
                if (activeRules.length === 0) {
                    vscode.window.showInformationMessage('No rules are currently active');
                    return;
                }

                const quickPickItems = activeRules.map(rule => ({
                    label: rule.name,
                    description: `${rule.category} • ${rule.technologies.join(', ')}`,
                    detail: rule.description,
                    rule
                }));

                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: 'Select a rule to deactivate',
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    ruleId = selected.rule.id;
                }
            }

            if (ruleId) {
                await this.rulesManager.deactivateRule(ruleId);
            }
        } catch (error) {
            console.error('Failed to deactivate rule:', error);
        }
    }

    private async toggleRule(ruleId: string): Promise<void> {
        try {
            // Use ultra-fast toggle for immediate response
            await this.rulesManager.ultraFastToggleRule(ruleId);
        } catch (error) {
            console.error('Failed to toggle rule:', error);
            // Fallback to notification on error
            vscode.window.showErrorMessage(`Failed to toggle rule: ${error}`);
        }
    }

    // Enhanced bulk operations for better performance
    private async bulkToggleRules(ruleIds: string[]): Promise<void> {
        try {
            if (ruleIds.length === 0) return;
            
            // Show progress for bulk operations
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Toggling ${ruleIds.length} rules...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                // Use batch toggle for maximum performance
                await this.rulesManager.batchToggleRules(ruleIds);
                
                progress.report({ increment: 100 });
            });
            
            vscode.window.showInformationMessage(`Successfully toggled ${ruleIds.length} rules`);
        } catch (error) {
            console.error('Failed to bulk toggle rules:', error);
            vscode.window.showErrorMessage(`Failed to toggle rules: ${error}`);
        }
    }

    // Show menu for bulk toggle operations
    private async showBulkToggleMenu(): Promise<void> {
        try {
            const rules = await this.rulesManager.getAllRules();
            if (rules.length === 0) {
                vscode.window.showInformationMessage('No rules available');
                return;
            }

            const quickPickItems = rules.map(rule => ({
                label: rule.name,
                description: `${rule.category} • ${rule.technologies.join(', ')} • ${rule.isActive ? '✓ Active' : 'Inactive'}`,
                detail: rule.description,
                picked: false, // Default selection
                rule: rule
            }));

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select rules to toggle (multiple selection)',
                canPickMany: true,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected && selected.length > 0) {
                const ruleIds = selected.map(item => item.rule.id);
                await this.bulkToggleRules(ruleIds);
            }
        } catch (error) {
            console.error('Failed to show bulk toggle menu:', error);
            vscode.window.showErrorMessage(`Failed to show bulk toggle menu: ${error}`);
        }
    }

    private async deleteRule(ruleIdOrTreeItem?: string | any): Promise<void> {
        try {
            let ruleId: string | undefined;
            
            // Handle different argument types
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem?.rule?.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            }
            
            if (!ruleId) {
                // Show quick pick to select rule
                const rules = await this.rulesManager.getAllRules();
                const customRules = rules.filter(r => r.isCustom);
                
                if (customRules.length === 0) {
                    vscode.window.showInformationMessage('No custom rules to delete');
                    return;
                }

                const quickPickItems = customRules.map(rule => ({
                    label: rule.name,
                    description: `${rule.category} • ${rule.technologies.join(', ')}`,
                    detail: rule.description,
                    rule
                }));

                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: 'Select a custom rule to delete',
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    ruleId = selected.rule.id;
                }
            }

            if (ruleId) {
                const rule = await this.rulesManager.getRuleById(ruleId);
                if (!rule) {
                    vscode.window.showErrorMessage('Rule not found');
                    return;
                }

                if (!rule.isCustom) {
                    vscode.window.showErrorMessage('Only custom rules can be deleted');
                    return;
                }

                const confirmation = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the rule "${rule.name}"?`,
                    'Delete',
                    'Cancel'
                );

                if (confirmation === 'Delete') {
                    await this.rulesManager.deleteRule(ruleId);
                }
            }
        } catch (error) {
            console.error('Failed to delete rule:', error);
        }
    }

    private async previewRule(ruleIdOrTreeItem?: string | any): Promise<void> {
        try {
            let ruleId: string | undefined;
            
            // Handle different argument types
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem?.rule?.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            }
            
            if (!ruleId) {
                // Show quick pick to select rule
                const rules = await this.rulesManager.getAllRules();
                
                const quickPickItems = rules.map(rule => ({
                    label: rule.name,
                    description: `${rule.category} • ${rule.technologies.join(', ')} • ${rule.isActive ? 'Active' : 'Inactive'}`,
                    detail: rule.description,
                    rule
                }));

                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: 'Select a rule to preview',
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    ruleId = selected.rule.id;
                }
            }

            if (ruleId) {
                await this.rulesManager.previewRule(ruleId);
            }
        } catch (error) {
            console.error('Failed to preview rule:', error);
        }
    }

    private async addToFavorites(ruleIdOrTreeItem: string | any): Promise<void> {
        try {
            let ruleId: string | undefined;
            
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem?.rule?.id) {
                ruleId = ruleIdOrTreeItem.rule.id;
            }

            if (ruleId) {
                await this.rulesManager.toggleRuleFavorite(ruleId);
            }
        } catch (error) {
            console.error('Failed to add rule to favorites:', error);
        }
    }

    private async removeFromFavorites(ruleIdOrTreeItem: string | any): Promise<void> {
        try {
            let ruleId: string | undefined;
            
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem?.rule?.id) {
                ruleId = ruleIdOrTreeItem.rule.id;
            }

            if (ruleId) {
                await this.rulesManager.toggleRuleFavorite(ruleId);
            }
        } catch (error) {
            console.error('Failed to remove rule from favorites:', error);
        }
    }

    private async importCustomRule(): Promise<void> {
        try {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter rule name',
                placeHolder: 'My Custom Rule'
            });

            if (!name) {
                return;
            }

            const content = await vscode.window.showInputBox({
                prompt: 'Enter rule content',
                placeHolder: 'You are an expert developer...'
            });

            if (!content) {
                return;
            }

            const technologiesInput = await vscode.window.showInputBox({
                prompt: 'Enter technologies (comma-separated)',
                placeHolder: 'React, TypeScript, Node.js'
            });

            const technologies = technologiesInput ? 
                technologiesInput.split(',').map(t => t.trim()).filter(t => t) : 
                [];

            await this.rulesManager.importCustomRule(name, content, technologies);
        } catch (error) {
            console.error('Failed to import custom rule:', error);
        }
    }

    private async exportRules(): Promise<void> {
        try {
            const exportOptions = [
                { label: 'Export All Rules', value: 'all' },
                { label: 'Export Active Rules', value: 'active' },
                { label: 'Export Favorite Rules', value: 'favorites' }
            ];

            const selected = await vscode.window.showQuickPick(exportOptions, {
                placeHolder: 'Select export option'
            });

            if (!selected) {
                return;
            }

            switch (selected.value) {
                case 'all':
                    await this.rulesManager.exportRules();
                    break;
                case 'active':
                    const activeRules = await this.rulesManager.getActiveRules();
                    await this.rulesManager.exportRules(activeRules.map(r => r.id));
                    break;
                case 'favorites':
                    const favoriteRules = await this.rulesManager.getFavoriteRules();
                    await this.rulesManager.exportRules(favoriteRules.map(r => r.id));
                    break;
            }
        } catch (error) {
            console.error('Failed to export rules:', error);
        }
    }

    private async openSettings(): Promise<void> {
        try {
            // Set context to show settings view and hide other views
            await vscode.commands.executeCommand('setContext', 'solidrules.showSettings', true);
            console.log('✅ Settings view opened');
        } catch (error) {
            console.error('❌ Failed to open settings:', error);
            vscode.window.showErrorMessage(`Failed to open settings: ${error}`);
        }
    }

    private async closeSettings(): Promise<void> {
        try {
            // Set context to hide settings view and show normal views
            await vscode.commands.executeCommand('setContext', 'solidrules.showSettings', false);
            console.log('✅ Settings view closed');
        } catch (error) {
            console.error('❌ Failed to close settings:', error);
            vscode.window.showErrorMessage(`Failed to close settings: ${error}`);
        }
    }

    private async updateRule(ruleId: string): Promise<void> {
        try {
            await this.rulesManager.updateRule(ruleId);
        } catch (error) {
            console.error('Failed to update rule:', error);
        }
    }

    private async updateAllRules(): Promise<void> {
        try {
            await this.rulesManager.updateAllRules();
        } catch (error) {
            console.error('Failed to update all rules:', error);
        }
    }

    private async syncWorkspace(): Promise<void> {
        try {
            await this.rulesManager.syncWorkspaceFiles();
            vscode.window.showInformationMessage('Workspace files synced successfully');
        } catch (error) {
            console.error('Failed to sync workspace:', error);
            vscode.window.showErrorMessage('Failed to sync workspace files');
        }
    }

    private async clearFilters(): Promise<void> {
        try {
            await this.rulesExplorerProvider.clearFilters();
            vscode.window.showInformationMessage('Filters cleared');
        } catch (error) {
            console.error('Failed to clear filters:', error);
        }
    }

    private async filterByTechnology(): Promise<void> {
        try {
            const technologies = await this.rulesManager.getTechnologies();
            const sortedTechs = technologies
                .sort((a, b) => b.count - a.count)
                .map(t => ({ label: `${t.name} (${t.count})`, value: t.name }));

            const options = [
                { label: 'All Technologies', value: 'all' },
                ...sortedTechs
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Filter by technology'
            });

            if (selected) {
                const filters = selected.value === 'all' 
                    ? { sortBy: 'recent' as const }
                    : { technology: selected.value, sortBy: 'recent' as const };
                await this.rulesExplorerProvider.applyFilters(filters);
            }
        } catch (error) {
            console.error('Failed to filter by technology:', error);
        }
    }

    private async filterByCategory(): Promise<void> {
        try {
            const categories = await this.rulesManager.getCategories();
            
            const options = [
                { label: 'All Categories', value: 'all' },
                ...categories.map(cat => ({ label: cat, value: cat }))
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Filter by category'
            });

            if (selected) {
                const filters = selected.value === 'all' 
                    ? { sortBy: 'recent' as const }
                    : { category: selected.value, sortBy: 'recent' as const };
                await this.rulesExplorerProvider.applyFilters(filters);
            }
        } catch (error) {
            console.error('Failed to filter by category:', error);
        }
    }

    private async sortRules(): Promise<void> {
        try {
            const options = [
                { label: 'Most Recent', value: 'recent' },
                { label: 'Alphabetical', value: 'alphabetical' },
                { label: 'Popularity', value: 'popularity' }
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Sort rules by...'
            });

            if (selected) {
                await this.rulesExplorerProvider.applyFilters({ sortBy: selected.value as 'recent' | 'alphabetical' | 'popularity' });
            }
        } catch (error) {
            console.error('Failed to sort rules:', error);
        }
    }

    private async configureGitHubToken(): Promise<void> {
        try {
            const token = await vscode.window.showInputBox({
                prompt: 'Enter your GitHub Personal Access Token',
                placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                password: true,
                ignoreFocusOut: true,
                validateInput: (value) => {
                    // Enhanced input validation
                    if (!value) {
                        return 'Token is required';
                    }
                    if (value.length < 10) {
                        return 'Token appears to be too short';
                    }
                    if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                        return 'Token should start with "ghp_" or "github_pat_"';
                    }
                    return null;
                }
            });

            if (token) {
                // Use secure token storage instead of configuration
                const githubService = this.rulesManager.getGitHubService();
                await githubService.setSecureToken(token);
                
                // Update the context to show the Rules Explorer
                await vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', true);
                
                vscode.window.showInformationMessage('✅ GitHub token configured and stored securely');
                
                // Refresh rules after token setup
                await this.rulesManager.refreshRules();
            }
        } catch (error) {
            console.error('❌ Failed to configure GitHub token:', error);
            vscode.window.showErrorMessage(`Failed to configure GitHub token: ${error}`);
            throw error;
        }
    }

    private async resetGitHubToken(): Promise<void> {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                'Are you sure you want to reset your GitHub token? This will limit you to 60 requests per hour instead of 5000.',
                { modal: true },
                'Reset Token',
                'Cancel'
            );

            if (confirmation === 'Reset Token') {
                // Use secure token storage instead of configuration
                const githubService = this.rulesManager.getGitHubService();
                await githubService.deleteSecureToken();
                
                // Set context to hide other panels and show token setup
                await vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', false);
                
                vscode.window.showInformationMessage('✅ GitHub token has been reset securely');
            }
        } catch (error) {
            console.error('❌ Failed to reset GitHub token:', error);
            vscode.window.showErrorMessage(`Failed to reset GitHub token: ${error}`);
            throw error;
        }
    }

    private async clearDatabase(): Promise<void> {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                'Are you sure you want to clear all rules and data? This action cannot be undone.',
                { modal: true },
                'Clear Database',
                'Cancel'
            );

            if (confirmation === 'Clear Database') {
                const userInput = await vscode.window.showInputBox({
                    prompt: 'Type "CLEAR" to confirm database deletion',
                    placeHolder: 'CLEAR',
                    validateInput: (value) => {
                        // Enhanced validation for destructive operations
                        if (value !== 'CLEAR') {
                            return 'Please type "CLEAR" exactly to confirm';
                        }
                        return null;
                    }
                });

                if (userInput === 'CLEAR') {
                    // Clear database asynchronously without blocking UI
                    this.rulesManager.clearAllData().then(() => {
                        vscode.window.showInformationMessage('✅ Database cleared successfully');
                    }).catch(error => {
                        console.error('❌ Failed to clear database:', error);
                        vscode.window.showErrorMessage(`Failed to clear database: ${error}`);
                    });
                    
                    // Show immediate feedback
                    vscode.window.showInformationMessage('Clearing database...');
                } else {
                    vscode.window.showInformationMessage('Database clear cancelled');
                }
            }
        } catch (error) {
            console.error('❌ Failed to start clear database:', error);
            vscode.window.showErrorMessage(`Failed to start clear database: ${error}`);
        }
    }

    private async skipTokenSetup(): Promise<void> {
        try {
            const confirmation = await vscode.window.showWarningMessage(
                'Without a GitHub token, you\'ll be limited to 60 requests per hour. You can configure a token later for 5000 requests per hour.',
                'Continue Without Token',
                'Setup Token'
            );

            if (confirmation === 'Continue Without Token') {
                // Set context to show other panels
                await vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', true);
                
                // Refresh rules with rate limit
                await this.rulesManager.refreshRules();
                vscode.window.showInformationMessage('✅ Continuing without token (rate limited)');
            } else if (confirmation === 'Setup Token') {
                await this.configureGitHubToken();
            }
        } catch (error) {
            console.error('❌ Failed to skip token setup:', error);
            throw error;
        }
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
} 