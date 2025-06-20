import * as vscode from 'vscode';
import { RulesManager } from './RulesManager';
import { RulesExplorerProvider } from '../providers/RulesExplorerProvider';
import { ActiveRulesProvider } from '../providers/ActiveRulesProvider';
import { FavoritesProvider } from '../providers/FavoritesProvider';
import { Technology } from '../types';

export class CommandManager {
    private disposables: vscode.Disposable[] = [];

    constructor(
        private rulesManager: RulesManager,
        private rulesExplorerProvider: RulesExplorerProvider,
        private activeRulesProvider: ActiveRulesProvider,
        private favoritesProvider: FavoritesProvider
    ) {}

    registerCommands(context: vscode.ExtensionContext): void {
        // Register all commands
        this.disposables.push(
                        vscode.commands.registerCommand('solidrules.refreshRules', () => this.refreshRules()),
            vscode.commands.registerCommand('solidrules.searchRules', () => this.searchRules()),
            vscode.commands.registerCommand('solidrules.activateRule', (ruleId: string) => this.activateRule(ruleId)),
            vscode.commands.registerCommand('solidrules.deactivateRule', (ruleId: string) => this.deactivateRule(ruleId)),
            vscode.commands.registerCommand('solidrules.toggleRule', (ruleId: string) => this.toggleRule(ruleId)),
            vscode.commands.registerCommand('solidrules.deleteRule', (ruleId: string) => this.deleteRule(ruleId)),
            vscode.commands.registerCommand('solidrules.previewRule', (ruleId: string) => this.previewRule(ruleId)),
            vscode.commands.registerCommand('solidrules.addToFavorites', (ruleId: string) => this.addToFavorites(ruleId)),
            vscode.commands.registerCommand('solidrules.removeFromFavorites', (ruleId: string) => this.removeFromFavorites(ruleId)),
            vscode.commands.registerCommand('solidrules.importCustomRule', () => this.importCustomRule()),
            vscode.commands.registerCommand('solidrules.exportRules', () => this.exportRules()),
            vscode.commands.registerCommand('solidrules.settings', () => this.openSettings()),
            vscode.commands.registerCommand('solidrules.updateRule', (ruleId: string) => this.updateRule(ruleId)),
            vscode.commands.registerCommand('solidrules.updateAllRules', () => this.updateAllRules()),
            vscode.commands.registerCommand('solidrules.clearFilters', () => this.clearFilters()),
            vscode.commands.registerCommand('solidrules.filterByTechnology', () => this.filterByTechnology()),
            vscode.commands.registerCommand('solidrules.filterByCategory', () => this.filterByCategory()),
            vscode.commands.registerCommand('solidrules.sortRules', () => this.sortRules()),
            vscode.commands.registerCommand('solidrules.configureGitHubToken', () => this.configureGitHubToken()),
            vscode.commands.registerCommand('solidrules.resetGitHubToken', () => this.resetGitHubToken()),
            vscode.commands.registerCommand('solidrules.clearDatabase', () => this.clearDatabase()),
            vscode.commands.registerCommand('solidrules.skipTokenSetup', () => this.skipTokenSetup())
        );

        // Add disposables to context
        context.subscriptions.push(...this.disposables);
    }

    private async refreshRules(): Promise<void> {
        try {
            await this.rulesManager.refreshRules();
        } catch (error) {
            console.error('Failed to refresh rules:', error);
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
            } else if (ruleIdOrTreeItem && ruleIdOrTreeItem.rule && ruleIdOrTreeItem.rule.id) {
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
            } else if (ruleIdOrTreeItem && ruleIdOrTreeItem.rule && ruleIdOrTreeItem.rule.id) {
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
            const rule = await this.rulesManager.getRuleById(ruleId);
            if (!rule) {
                console.error('Rule not found:', ruleId);
                return;
            }

            // Toggle without notifications for smoother UX
            if (rule.isActive) {
                await this.rulesManager.deactivateRule(ruleId, false);
            } else {
                await this.rulesManager.activateRule(ruleId, false);
            }
        } catch (error) {
            console.error('Failed to toggle rule:', error);
        }
    }

    private async deleteRule(ruleIdOrTreeItem?: string | any): Promise<void> {
        try {
            let ruleId: string | undefined;
            
            // Handle different argument types
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem && ruleIdOrTreeItem.rule && ruleIdOrTreeItem.rule.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            }
            
            if (!ruleId) {
                // Show quick pick to select rule
                const rules = await this.rulesManager.getAllRules();
                
                if (rules.length === 0) {
                    vscode.window.showInformationMessage('No rules available to delete');
                    return;
                }

                const quickPickItems = rules.map(rule => ({
                    label: rule.name,
                    description: `${rule.category} • ${rule.technologies.join(', ')} ${rule.isCustom ? '(Custom)' : ''}`,
                    detail: rule.description,
                    rule
                }));

                const selected = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: 'Select a rule to delete permanently',
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    ruleId = selected.rule.id;
                }
            }

            if (ruleId) {
                await this.rulesManager.deleteRule(ruleId);
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
            } else if (ruleIdOrTreeItem && ruleIdOrTreeItem.rule && ruleIdOrTreeItem.rule.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            }
            
            if (!ruleId) {
                // Show quick pick to select rule
                const rules = await this.rulesManager.getAllRules();
                
                const quickPickItems = rules.map(rule => ({
                    label: rule.name,
                    description: `${rule.category} • ${rule.technologies.join(', ')}`,
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
            let ruleId: string;
            
            // Handle different argument types
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem && ruleIdOrTreeItem.rule && ruleIdOrTreeItem.rule.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            } else {
                console.error('Invalid ruleId provided to addToFavorites');
                return;
            }
            
            await this.rulesManager.toggleRuleFavorite(ruleId);
        } catch (error) {
            console.error('Failed to add to favorites:', error);
        }
    }

    private async removeFromFavorites(ruleIdOrTreeItem: string | any): Promise<void> {
        try {
            let ruleId: string;
            
            // Handle different argument types
            if (typeof ruleIdOrTreeItem === 'string') {
                ruleId = ruleIdOrTreeItem;
            } else if (ruleIdOrTreeItem && ruleIdOrTreeItem.rule && ruleIdOrTreeItem.rule.id) {
                // TreeItem passed from context menu
                ruleId = ruleIdOrTreeItem.rule.id;
            } else {
                console.error('Invalid ruleId provided to removeFromFavorites');
                return;
            }
            
            await this.rulesManager.toggleRuleFavorite(ruleId);
        } catch (error) {
            console.error('Failed to remove from favorites:', error);
        }
    }

    private async importCustomRule(): Promise<void> {
        try {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for your custom rule',
                placeHolder: 'My Custom Rule'
            });

            if (!name) {
                return;
            }

            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'CursorRules Files': ['cursorrules'],
                    'Text Files': ['txt'],
                    'All Files': ['*']
                },
                title: 'Select CursorRules file to import'
            });

            if (!uri || uri.length === 0) {
                return;
            }

            const document = await vscode.workspace.openTextDocument(uri[0]);
            const content = document.getText();

            if (!content.trim()) {
                vscode.window.showErrorMessage('The selected file is empty');
                return;
            }

            // Ask for technologies
            const technologiesInput = await vscode.window.showInputBox({
                prompt: 'Enter technologies (comma-separated)',
                placeHolder: 'react, typescript, tailwind'
            });

            const technologies = technologiesInput 
                ? technologiesInput.split(',').map(t => t.trim()).filter(Boolean)
                : [];

            // Ask for tags
            const tagsInput = await vscode.window.showInputBox({
                prompt: 'Enter tags (comma-separated)',
                placeHolder: 'frontend, styling, component'
            });

            const tags = tagsInput 
                ? tagsInput.split(',').map(t => t.trim()).filter(Boolean)
                : [];

            await this.rulesManager.importCustomRule(name, content, technologies, tags);

        } catch (error) {
            console.error('Failed to import custom rule:', error);
            vscode.window.showErrorMessage(`Failed to import custom rule: ${error}`);
        }
    }

    private async exportRules(): Promise<void> {
        try {
            const options = [
                'Export All Rules',
                'Export Active Rules',
                'Export Favorite Rules'
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeholder: 'What would you like to export?'
            });

            if (!selected) {
                return;
            }

            let ruleIds: string[] | undefined;
            
            switch (selected) {
                case 'Export Active Rules':
                    const activeRules = await this.rulesManager.getActiveRules();
                    ruleIds = activeRules.map(r => r.id);
                    break;
                case 'Export Favorite Rules':
                    const favoriteRules = await this.rulesManager.getFavoriteRules();
                    ruleIds = favoriteRules.map(r => r.id);
                    break;
            }

            await this.rulesManager.exportRules(ruleIds);

        } catch (error) {
            console.error('Failed to export rules:', error);
        }
    }

    private async openSettings(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'solidrules');
        } catch (error) {
            console.error('Failed to open settings:', error);
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

    private async clearFilters(): Promise<void> {
        try {
            await this.rulesExplorerProvider.clearFilters();
        } catch (error) {
            console.error('Failed to clear filters:', error);
        }
    }

    private async filterByTechnology(): Promise<void> {
        try {
            const rules = await this.rulesManager.getAllRules();
            const technologies = new Set<string>();
            
            rules.forEach(rule => {
                rule.technologies.forEach(tech => technologies.add(tech));
            });

            const sortedTechs = Array.from(technologies).sort();
            
            if (sortedTechs.length === 0) {
                vscode.window.showInformationMessage('No technologies found');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                ['All Technologies', ...sortedTechs],
                { placeholder: 'Filter by technology' }
            );

            if (selected) {
                const technology = selected === 'All Technologies' ? undefined : selected;
                await this.rulesExplorerProvider.applyFilters({ technology });
            }
        } catch (error) {
            console.error('Failed to filter by technology:', error);
        }
    }

    private async filterByCategory(): Promise<void> {
        try {
            const rules = await this.rulesManager.getAllRules();
            const categories = [...new Set(rules.map(r => r.category))].sort();
            
            if (categories.length === 0) {
                vscode.window.showInformationMessage('No categories found');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                ['All Categories', ...categories],
                { placeholder: 'Filter by category' }
            );

            if (selected) {
                const category = selected === 'All Categories' ? undefined : selected;
                await this.rulesExplorerProvider.applyFilters({ category });
            }
        } catch (error) {
            console.error('Failed to filter by category:', error);
        }
    }

    private async sortRules(): Promise<void> {
        try {
            const options = [
                { label: 'Most Recent', value: 'recent' as const },
                { label: 'Alphabetical', value: 'alphabetical' as const },
                { label: 'Most Popular', value: 'popularity' as const }
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeholder: 'Sort rules by...'
            });

            if (selected) {
                await this.rulesExplorerProvider.applyFilters({ sortBy: selected.value });
            }
        } catch (error) {
            console.error('Failed to sort rules:', error);
        }
    }

    private async configureGitHubToken(): Promise<void> {
        try {
            const token = await vscode.window.showInputBox({
                prompt: 'Entrez votre token GitHub personnel',
                placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
                password: true,
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Le token ne peut pas être vide';
                    }
                    if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                        return 'Le token doit commencer par "ghp_" ou "github_pat_"';
                    }
                    return null;
                }
            });

            if (token) {
                await this.saveGitHubToken(token.trim());
                vscode.window.showInformationMessage('Token GitHub configuré avec succès !');
                // Refresh the tree view
                vscode.commands.executeCommand('solidrules.refreshRules');
            }
        } catch (error) {
            console.error('Failed to configure GitHub token:', error);
            vscode.window.showErrorMessage('Erreur lors de la configuration du token GitHub');
        }
    }

    private async saveGitHubToken(token: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('solidrules');
        await config.update('githubToken', token, vscode.ConfigurationTarget.Global);
        
        // Set context to show other panels
        vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', true);
        
        // Refresh GitHub service
        const githubService = (this.rulesManager as any).githubService;
        if (githubService && typeof githubService.refreshToken === 'function') {
            githubService.refreshToken();
        }
    }

    private async resetGitHubToken(): Promise<void> {
        try {
            const confirm = await vscode.window.showWarningMessage(
                'Êtes-vous sûr de vouloir supprimer votre token GitHub ? Cela supprimera le token et vous ramènera à l\'écran de configuration.',
                'Supprimer le token',
                'Annuler'
            );
            
            if (confirm === 'Supprimer le token') {
                const config = vscode.workspace.getConfiguration('solidrules');
                await config.update('githubToken', '', vscode.ConfigurationTarget.Global);
                await config.update('tokenSetupCompleted', false, vscode.ConfigurationTarget.Global);
                
                // Set context to show token setup panel
                vscode.commands.executeCommand('setContext', 'solidrules.tokenConfigured', false);
                
                // Refresh GitHub service to use no token
                const githubService = (this.rulesManager as any).githubService;
                if (githubService && typeof githubService.refreshToken === 'function') {
                    githubService.refreshToken();
                }
                
                // Refresh tree views
                this.rulesExplorerProvider.refresh();
                this.activeRulesProvider.refresh();
                this.favoritesProvider.refresh();
                
                vscode.window.showInformationMessage('Token GitHub supprimé. Vous pouvez maintenant configurer un nouveau token.');
            }
        } catch (error) {
            console.error('Failed to reset GitHub token:', error);
            vscode.window.showErrorMessage('Erreur lors de la suppression du token GitHub');
        }
    }

    private async clearDatabase(): Promise<void> {
        try {
            const confirm = await vscode.window.showWarningMessage(
                '⚠️ ATTENTION : Cette action supprimera TOUTES les données de SolidRules !\n\n' +
                'Cela inclut :\n' +
                '• Toutes les règles téléchargées\n' +
                '• Vos favoris\n' +
                '• Les configurations de workspace\n' +
                '• L\'historique des mises à jour\n\n' +
                'Cette action est IRRÉVERSIBLE !',
                'Supprimer toutes les données',
                'Annuler'
            );
            
            if (confirm === 'Supprimer toutes les données') {
                // Double confirmation for such a destructive action
                const doubleConfirm = await vscode.window.showWarningMessage(
                    '🚨 CONFIRMATION FINALE\n\n' +
                    'Êtes-vous ABSOLUMENT sûr de vouloir supprimer toutes les données ?\n' +
                    'Cette action ne peut pas être annulée !',
                    'OUI, supprimer tout',
                    'Non, annuler'
                );
                
                if (doubleConfirm === 'OUI, supprimer tout') {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Suppression des données...',
                        cancellable: false
                    }, async (progress) => {
                        progress.report({ message: 'Vidage de la base de données...' });
                        
                        await this.rulesManager.clearAllData();
                        
                        progress.report({ message: 'Actualisation des vues...' });
                        
                        // Refresh all tree views
                        this.rulesExplorerProvider.refresh();
                        this.activeRulesProvider.refresh();
                        this.favoritesProvider.refresh();
                    });
                    
                    vscode.window.showInformationMessage(
                        '✅ Base de données vidée avec succès !\n\n' +
                        'Utilisez "Refresh Rules" pour recharger les données depuis GitHub.'
                    );
                }
            }
        } catch (error) {
            console.error('Failed to clear database:', error);
            vscode.window.showErrorMessage(`Erreur lors du vidage de la base de données: ${error}`);
        }
    }

    private async skipTokenSetup(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('solidrules');
            
            // Mark setup as completed without setting a token
            await config.update('tokenSetupCompleted', true, vscode.ConfigurationTarget.Global);
            
            // Show warning about limitations
            await vscode.window.showWarningMessage(
                'Configuration du token GitHub ignorée. Vous serez limité à 60 requêtes/heure.\n\n' +
                'Vous pourrez configurer un token plus tard depuis les paramètres de l\'extension ou en cliquant sur l\'icône clé.',
                'OK'
            );
            
            // Refresh the tree view to show rules
            this.rulesExplorerProvider.refresh();
            this.activeRulesProvider.refresh();
            this.favoritesProvider.refresh();
            
            vscode.window.showInformationMessage('Vous pouvez maintenant utiliser SolidRules avec un débit limité (60 requêtes/heure).');
            
        } catch (error) {
            console.error('Failed to skip token setup:', error);
            vscode.window.showErrorMessage(`Failed to skip setup: ${error}`);
        }
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
} 