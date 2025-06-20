import * as vscode from 'vscode';
import { DatabaseManager } from './DatabaseManager';
import { GitHubService } from '../services/GitHubService';
import { NotificationManager } from './NotificationManager';
import { WorkspaceManager } from './WorkspaceManager';
import { CursorRule, SearchFilters, WorkspaceRuleConfig, UpdateInfo, Technology } from '../types';
import { formatDistanceToNow } from 'date-fns';

export class RulesManager {
    private _onDidChangeRules = new vscode.EventEmitter<void>();
    public readonly onDidChangeRules = this._onDidChangeRules.event;

    constructor(
        private databaseManager: DatabaseManager,
        private githubService: GitHubService,
        private notificationManager: NotificationManager,
        private workspaceManager: WorkspaceManager
    ) {}

    async initializeRules(): Promise<void> {
        try {
            const existingRules = await this.databaseManager.getAllRules();
            
            // Don't automatically fetch rules on startup to avoid rate limiting
            // Users can manually refresh when needed
            if (existingRules.length === 0) {
                console.log('No rules found locally. Use "Refresh Rules" to fetch from GitHub.');
                await this.notificationManager.showInformationMessage(
                    'Welcome to SolidRules! Click "Refresh Rules" to load rules from GitHub.',
                    'Got it'
                );
            } else {
                console.log(`Loaded ${existingRules.length} rules from local storage.`);
            }
        } catch (error) {
            console.error('Failed to initialize rules:', error);
            // Don't throw error on initialization to prevent extension from failing to load
        }
    }

    async refreshRules(): Promise<void> {
        try {
            // Check if GitHub token is configured
            const config = vscode.workspace.getConfiguration('solidrules');
            const githubToken = config.get<string>('githubToken', '');
            
            if (!githubToken) {
                const setupToken = await vscode.window.showWarningMessage(
                    'GitHub token not configured. You may hit rate limits (60 requests/hour).\n\n' +
                    'Setup a FREE GitHub token for 5000 requests/hour?',
                    'Setup Token',
                    'Continue Anyway'
                );
                
                if (setupToken === 'Setup Token') {
                    await vscode.commands.executeCommand('solidrules.configureGitHubToken');
                    return; // Exit, user can retry after setup
                }
            }
            
            await this.notificationManager.showProgress(
                'Refreshing rules from GitHub...',
                async (progress) => {
                    progress.report({ message: 'Fetching rules list...' });
                    
                    const githubRules = await this.githubService.fetchRulesList();
                    progress.report({ message: `Found ${githubRules.length} rules. Processing...` });
                    
                    let processedCount = 0;
                    for (const githubRule of githubRules) {
                        try {
                            const cursorRule = await this.githubService.createCursorRuleFromGitHub(githubRule);
                            cursorRule.version = githubRule.sha;
                            await this.databaseManager.saveRule(cursorRule);
                            
                            processedCount++;
                            progress.report({ 
                                message: `Processing ${processedCount}/${githubRules.length}...`,
                                increment: (100 / githubRules.length) 
                            });
                        } catch (error) {
                            console.error(`Failed to process rule ${githubRule.name}:`, error);
                        }
                    }
                    
                    progress.report({ message: 'Finalizing...' });
                }
            );

            await this.notificationManager.showRulesRefreshedNotification(
                (await this.databaseManager.getAllRules()).length
            );
            
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error('Failed to refresh rules:', error);
            await this.notificationManager.showErrorMessage(
                `Failed to refresh rules: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    async getAllRules(): Promise<CursorRule[]> {
        return await this.databaseManager.getAllRules();
    }

    async getRuleById(id: string): Promise<CursorRule | null> {
        return await this.databaseManager.getRuleById(id);
    }

    async searchRules(query: string, filters?: SearchFilters): Promise<CursorRule[]> {
        let rules: CursorRule[];

        if (query.trim() === '') {
            // No search query, get all rules
            if (filters?.showFavoritesOnly) {
                rules = await this.databaseManager.getFavoriteRules();
            } else if (filters?.showActiveOnly) {
                rules = await this.databaseManager.getActiveRules();
            } else {
                rules = await this.databaseManager.getAllRules();
            }
        } else {
            // Search with query
            rules = await this.databaseManager.searchRules(query, {
                ...(filters?.technology && { technology: filters.technology }),
                ...(filters?.category && { category: filters.category })
            });
        }

        // Apply additional filters
        if (filters) {
            if (filters.technology && !query) {
                rules = rules.filter(rule => 
                    rule.technologies.some(tech => 
                        tech.toLowerCase().includes(filters.technology!.toLowerCase())
                    )
                );
            }

            if (filters.category) {
                rules = rules.filter(rule => rule.category === filters.category);
            }

            if (filters.tags && filters.tags.length > 0) {
                rules = rules.filter(rule =>
                    filters.tags!.some(tag =>
                        rule.tags.some(ruleTag =>
                            ruleTag.toLowerCase().includes(tag.toLowerCase())
                        )
                    )
                );
            }

            if (filters.showFavoritesOnly) {
                rules = rules.filter(rule => rule.isFavorite);
            }

            if (filters.showActiveOnly) {
                rules = rules.filter(rule => rule.isActive);
            }
        }

        // Sort rules
        const sortBy = filters?.sortBy || 'recent';
        return this.sortRules(rules, sortBy);
    }

    private sortRules(rules: CursorRule[], sortBy: 'recent' | 'alphabetical' | 'popularity'): CursorRule[] {
        switch (sortBy) {
            case 'alphabetical':
                return rules.sort((a, b) => a.name.localeCompare(b.name));
            case 'popularity':
                // Sort by number of technologies (proxy for popularity)
                return rules.sort((a, b) => b.technologies.length - a.technologies.length);
            case 'recent':
            default:
                return rules.sort((a, b) => 
                    (b.lastUpdated || b.createdAt).getTime() - (a.lastUpdated || a.createdAt).getTime()
                );
        }
    }

    async getTechnologies(): Promise<Technology[]> {
        const rules = await this.databaseManager.getAllRules();
        const techMap = new Map<string, number>();

        rules.forEach(rule => {
            rule.technologies.forEach(tech => {
                const normalizedTech = tech.toLowerCase();
                techMap.set(normalizedTech, (techMap.get(normalizedTech) || 0) + 1);
            });
        });

        return Array.from(techMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }

    async getCategories(): Promise<string[]> {
        const rules = await this.databaseManager.getAllRules();
        const categories = [...new Set(rules.map(rule => rule.category))];
        return categories.sort();
    }

    async activateRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            await this.databaseManager.updateRuleStatus(ruleId, true);
            rule.isActive = true;

            await this.updateWorkspaceRules();
            await this.notificationManager.showRuleActivatedNotification(rule.name);
            
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error(`Failed to activate rule ${ruleId}:`, error);
            await this.notificationManager.showErrorMessage(`Failed to activate rule: ${error}`);
            throw error;
        }
    }

    async deactivateRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            await this.databaseManager.updateRuleStatus(ruleId, false);
            rule.isActive = false;

            await this.updateWorkspaceRules();
            await this.notificationManager.showRuleDeactivatedNotification(rule.name);
            
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error(`Failed to deactivate rule ${ruleId}:`, error);
            await this.notificationManager.showErrorMessage(`Failed to deactivate rule: ${error}`);
            throw error;
        }
    }

    async toggleRuleFavorite(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            const newFavoriteStatus = !rule.isFavorite;
            await this.databaseManager.updateRuleFavorite(ruleId, newFavoriteStatus);
            rule.isFavorite = newFavoriteStatus;

            if (newFavoriteStatus) {
                await this.notificationManager.showRuleAddedToFavoritesNotification(rule.name);
            } else {
                await this.notificationManager.showRuleRemovedFromFavoritesNotification(rule.name);
            }
            
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error(`Failed to toggle favorite for rule ${ruleId}:`, error);
            await this.notificationManager.showErrorMessage(`Failed to update favorite: ${error}`);
            throw error;
        }
    }

    async importCustomRule(name: string, content: string, technologies: string[] = [], tags: string[] = []): Promise<void> {
        try {
            const customRule: CursorRule = {
                id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name,
                description: 'Custom imported rule',
                content,
                technologies,
                tags: [...tags, 'custom'],
                category: 'Custom',
                isActive: false,
                isFavorite: false,
                isCustom: true,
                createdAt: new Date()
            };

            await this.databaseManager.saveRule(customRule);
            await this.notificationManager.showCustomRuleImportedNotification(name);
            
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error('Failed to import custom rule:', error);
            await this.notificationManager.showErrorMessage(`Failed to import custom rule: ${error}`);
            throw error;
        }
    }

    async deleteRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            const confirmed = await this.notificationManager.confirmDeleteRule(rule.name);
            if (!confirmed) {
                return;
            }

            await this.databaseManager.deleteRule(ruleId);
            
            if (rule.isActive) {
                await this.updateWorkspaceRules();
            }
            
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error(`Failed to delete rule ${ruleId}:`, error);
            await this.notificationManager.showErrorMessage(`Failed to delete rule: ${error}`);
            throw error;
        }
    }

    async checkForUpdates(): Promise<void> {
        try {
            const rules = await this.databaseManager.getAllRules();
            const nonCustomRules = rules.filter(rule => !rule.isCustom);
            
            if (nonCustomRules.length === 0) {
                return;
            }

            const updateMap = await this.githubService.checkForUpdates(nonCustomRules);
            const updatesInfo: UpdateInfo[] = [];

            for (const [ruleId, hasUpdate] of updateMap) {
                const rule = await this.databaseManager.getRuleById(ruleId);
                if (rule && hasUpdate) {
                    const updateInfo: UpdateInfo = {
                        ruleId: rule.id,
                        ruleName: rule.name,
                        hasUpdate: true,
                        currentVersion: rule.version,
                        lastChecked: new Date()
                    };
                    
                    await this.databaseManager.saveUpdateInfo(updateInfo);
                    updatesInfo.push(updateInfo);
                }
            }

            if (updatesInfo.length > 0) {
                await this.notificationManager.showUpdateNotification(updatesInfo);
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        }
    }

    async updateRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule || rule.isCustom || !rule.githubPath) {
                throw new Error('Rule cannot be updated');
            }

            const githubRuleInfo = {
                path: rule.githubPath,
                name: rule.name,
                sha: '',
                size: 0,
                download_url: '',
                type: 'dir' as const
            };

            const updatedRule = await this.githubService.createCursorRuleFromGitHub(githubRuleInfo);
            updatedRule.id = rule.id;
            updatedRule.isActive = rule.isActive;
            updatedRule.isFavorite = rule.isFavorite;
            updatedRule.lastUpdated = new Date();

            await this.databaseManager.saveRule(updatedRule);
            
            if (rule.isActive) {
                await this.updateWorkspaceRules();
            }
            
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error(`Failed to update rule ${ruleId}:`, error);
            await this.notificationManager.showErrorMessage(`Failed to update rule: ${error}`);
            throw error;
        }
    }

    async updateAllRules(): Promise<void> {
        try {
            const updatesInfo = await this.databaseManager.getUpdatesInfo();
            
            for (const update of updatesInfo) {
                await this.updateRule(update.ruleId);
            }
            
            await this.notificationManager.showSuccessMessage(
                `Successfully updated ${updatesInfo.length} rules`
            );
        } catch (error) {
            console.error('Failed to update all rules:', error);
            await this.notificationManager.showErrorMessage(`Failed to update rules: ${error}`);
            throw error;
        }
    }

    private async updateWorkspaceRules(): Promise<void> {
        const workspaceId = this.workspaceManager.getCurrentWorkspaceId();
        if (!workspaceId) {
            return;
        }

        try {
            const activeRules = await this.databaseManager.getActiveRules();
            const config = vscode.workspace.getConfiguration('solidrules');
            const rulesDirectory = config.get<string>('rulesDirectory', 'cursorRules');

            const workspaceConfig: WorkspaceRuleConfig = {
                workspaceId,
                activeRules: activeRules.map(r => r.id),
                rulesDirectory,
                lastSyncDate: new Date()
            };

            await this.databaseManager.saveWorkspaceConfig(workspaceConfig);
            await this.workspaceManager.syncActiveRules(activeRules, workspaceConfig);
            
        } catch (error) {
            console.error('Failed to update workspace rules:', error);
        }
    }

    async getActiveRules(): Promise<CursorRule[]> {
        return await this.databaseManager.getActiveRules();
    }

    async getFavoriteRules(): Promise<CursorRule[]> {
        return await this.databaseManager.getFavoriteRules();
    }

    async previewRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            const document = await vscode.workspace.openTextDocument({
                content: rule.content,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(document, {
                preview: true,
                viewColumn: vscode.ViewColumn.Beside
            });
        } catch (error) {
            console.error(`Failed to preview rule ${ruleId}:`, error);
            await this.notificationManager.showErrorMessage(`Failed to preview rule: ${error}`);
        }
    }

    async exportRules(ruleIds?: string[]): Promise<void> {
        try {
            const rules = ruleIds 
                ? await Promise.all(ruleIds.map(id => this.databaseManager.getRuleById(id)).filter(Boolean))
                : await this.databaseManager.getAllRules();

            const exportData = {
                exportedAt: new Date().toISOString(),
                exportedBy: 'SolidRules Extension',
                rules: rules.map(rule => ({
                    ...rule,
                    createdAt: rule?.createdAt.toISOString(),
                    lastUpdated: rule?.lastUpdated?.toISOString()
                }))
            };

            const document = await vscode.workspace.openTextDocument({
                content: JSON.stringify(exportData, null, 2),
                language: 'json'
            });
            
            await vscode.window.showTextDocument(document);
        } catch (error) {
            console.error('Failed to export rules:', error);
            await this.notificationManager.showErrorMessage(`Failed to export rules: ${error}`);
        }
    }

    getWorkspaceStats(): string {
        const workspaceName = this.workspaceManager.getCurrentWorkspaceName();
        return workspaceName;
    }

    formatLastUpdated(date: Date | undefined): string {
        if (!date) return 'Never';
        return formatDistanceToNow(date, { addSuffix: true });
    }

    dispose(): void {
        this._onDidChangeRules.dispose();
    }
} 