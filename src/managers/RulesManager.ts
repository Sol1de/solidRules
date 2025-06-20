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
            // Refresh GitHub token first (in case it was just configured)
            this.githubService.refreshToken();
            
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

            let processedRulesCount = 0;
            
            await this.notificationManager.showProgress(
                'Refreshing rules from GitHub...',
                async (progress) => {
                    progress.report({ message: 'Fetching rules list...' });
                    
                    const githubRules = await this.githubService.fetchRulesList();
                    const existingRules = await this.databaseManager.getAllRules();
                    
                    console.log(`📊 Database contains ${existingRules.length} existing rules`);
                    console.log(`📊 GitHub returned ${githubRules.length} rules from API`);
                    
                    // Filter out rules that haven't changed (same SHA)
                    const existingRulesMap = new Map(
                        existingRules
                            .filter(r => r.githubPath && !r.isCustom)
                            .map(r => [r.githubPath, r.version])
                    );
                    
                    console.log(`📊 Found ${existingRulesMap.size} existing GitHub rules in database`);
                    
                    // Debug: Show some examples of existing rules
                    const sampleRules = existingRules.slice(0, 3);
                    sampleRules.forEach(rule => {
                        console.log(`🔍 Sample rule: ${rule.name} | githubPath: ${rule.githubPath} | version: ${rule.version} | isCustom: ${rule.isCustom}`);
                    });
                    
                    // Smart refresh logic: if database is empty or very few rules, force full refresh
                    const shouldForceRefresh = existingRules.length === 0 || existingRules.length < (githubRules.length * 0.5);
                    
                    let rulesToUpdate: typeof githubRules;
                    
                    if (shouldForceRefresh) {
                        console.log(`🔄 Smart refresh: Database has ${existingRules.length} rules, GitHub has ${githubRules.length}. Forcing full refresh...`);
                        progress.report({ message: `Loading ALL ${githubRules.length} rules...` });
                        rulesToUpdate = githubRules; // Process ALL rules
                    } else {
                        // Normal incremental refresh
                        rulesToUpdate = githubRules.filter(githubRule => {
                            const existingVersion = existingRulesMap.get(githubRule.path);
                            const needsUpdate = !existingVersion || existingVersion !== githubRule.sha;
                            
                            if (!needsUpdate) {
                                console.log(`⏭️ Skipping ${githubRule.name} (up to date: ${existingVersion} === ${githubRule.sha})`);
                            } else {
                                console.log(`🔄 Needs update: ${githubRule.name} (existing: ${existingVersion}, new: ${githubRule.sha})`);
                            }
                            
                            return needsUpdate;
                        });
                        console.log(`📊 Incremental refresh: ${rulesToUpdate.length} rules need updating out of ${githubRules.length} total`);
                        progress.report({ 
                            message: `Found ${githubRules.length} rules. ${rulesToUpdate.length} need updating...` 
                        });
                    }
                    
                    if (rulesToUpdate.length === 0) {
                        progress.report({ message: 'All rules are up to date!' });
                        processedRulesCount = 0; // No rules processed
                        return;
                    }
                    
                    // Dynamic batch size based on GitHub token availability
                    const config = vscode.workspace.getConfiguration('solidrules');
                    const hasToken = !!config.get<string>('githubToken', '');
                    
                    // Optimize batch size based on rate limits and rule count
                    let BATCH_SIZE: number;
                    
                    if (hasToken) {
                        // With token: aggressive parallelization
                        if (rulesToUpdate.length <= 20) {
                            BATCH_SIZE = rulesToUpdate.length; // Process all at once for small sets
                        } else if (rulesToUpdate.length <= 100) {
                            BATCH_SIZE = Math.min(75, Math.ceil(rulesToUpdate.length / 2)); // Half at a time, up to 75
                        } else {
                            BATCH_SIZE = 100; // Maximum safe concurrent requests
                        }
                    } else {
                        // Without token: very conservative
                        BATCH_SIZE = Math.min(3, Math.ceil(rulesToUpdate.length / 15));
                    }
                    
                    console.log(`🚀 Processing ${rulesToUpdate.length} rules with batch size: ${BATCH_SIZE} (Token: ${hasToken ? '✅' : '❌'})`);
                    
                    const startTime = Date.now();
                    let processedCount = 0;
                    let totalRetries = 0;
                    let totalErrors = 0;
                    
                    for (let i = 0; i < rulesToUpdate.length; i += BATCH_SIZE) {
                        const batch = rulesToUpdate.slice(i, i + BATCH_SIZE);
                        
                                            // Process batch in parallel - fetch rules first, then batch save
                    const batchPromises = batch.map(async (githubRule, index) => {
                        const maxRetries = 3;
                        let attempt = 0;
                        
                        while (attempt < maxRetries) {
                            try {
                                // Add small delay between retries to avoid rate limiting
                                if (attempt > 0) {
                                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                    console.log(`🔄 Retry ${attempt}/${maxRetries} for ${githubRule.name}`);
                                }
                                
                                const cursorRule = await this.githubService.createCursorRuleFromGitHub(githubRule);
                                cursorRule.version = githubRule.sha;
                                console.log(`📥 Fetched rule: ${githubRule.name} (${cursorRule.category || 'Other'}) | SHA: ${githubRule.sha}`);
                                return { success: true, rule: cursorRule, attempt: attempt + 1, name: githubRule.name };
                            } catch (error: any) {
                                attempt++;
                                
                                // If it's a rate limit error and we have retries left, wait longer
                                if (error.message?.includes('rate limit') && attempt < maxRetries) {
                                    const rateLimitDelay = hasToken ? 2000 : 10000; // 2s with token, 10s without
                                    console.warn(`⚠️ Rate limit hit for ${githubRule.name}, waiting ${rateLimitDelay}ms...`);
                                    await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
                                    continue;
                                }
                                
                                if (attempt >= maxRetries) {
                                    console.error(`❌ Failed to process rule ${githubRule.name} after ${maxRetries} attempts:`, error);
                                    return { success: false, rule: null, error, attempts: attempt, name: githubRule.name };
                                }
                            }
                        }
                        
                        return { success: false, rule: null, error: 'Max retries exceeded', name: githubRule.name };
                    });
                        
                                            const batchResults = await Promise.allSettled(batchPromises);
                    
                    // Extract successfully fetched rules for batch save
                    const successfulRules: CursorRule[] = [];
                    batchResults.forEach(result => {
                        if (result.status === 'fulfilled' && result.value.success && result.value.rule) {
                            successfulRules.push(result.value.rule);
                        }
                    });
                    
                    // Batch save all successful rules at once
                    if (successfulRules.length > 0) {
                        await this.databaseManager.saveRulesBatch(successfulRules);
                    }
                    
                    processedCount += batch.length;
                    
                    progress.report({ 
                        message: `Processing ${processedCount}/${rulesToUpdate.length}... (${Math.round((processedCount / rulesToUpdate.length) * 100)}%)`,
                        increment: (batch.length / rulesToUpdate.length) * 100
                    });
                        
                        // Enhanced batch logging with performance metrics
                        const batchStartTime = Date.now();
                        const successful = batchResults.filter(r => r.status === 'fulfilled').length;
                        const failed = batchResults.filter(r => r.status === 'rejected').length;
                        const batchTime = Date.now() - batchStartTime;
                        
                        // Calculate retry statistics
                        const retryStats = batchResults
                            .filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<any>).value.success)
                            .map(r => ((r as PromiseFulfilledResult<any>).value as any)?.attempt || 1);
                        const avgRetries = retryStats.length > 0 
                            ? (retryStats.reduce((a, b) => a + b, 0) / retryStats.length).toFixed(1)
                            : '0';
                        
                        const batchNum = Math.ceil((i + BATCH_SIZE) / BATCH_SIZE);
                        const totalBatches = Math.ceil(rulesToUpdate.length / BATCH_SIZE);
                        
                        console.log(`📦 Batch ${batchNum}/${totalBatches}: ✅ ${successful} success, ❌ ${failed} failed, ⏱️ ${batchTime}ms, 🔄 avg ${avgRetries} retries`);
                        
                        // Update global statistics
                        totalRetries += retryStats.reduce((a, b) => a + b, 0) - retryStats.length; // Only count extra retries
                        totalErrors += failed;
                    }
                    
                    progress.report({ message: 'Finalizing...' });
                    
                    // Final performance summary
                    const totalTime = Date.now() - startTime;
                    const rulesPerSecond = ((processedCount / totalTime) * 1000).toFixed(1);
                    const successRate = (((processedCount - totalErrors) / processedCount) * 100).toFixed(1);
                    
                    console.log(`🏁 Completed! ${processedCount} rules processed in ${totalTime}ms`);
                    console.log(`📊 Performance: ${rulesPerSecond} rules/sec, ${successRate}% success rate, ${totalRetries} retries, ${totalErrors} errors`);
                    
                    // Store the count for notification
                    processedRulesCount = processedCount;
                }
            );

            const finalRuleCount = (await this.databaseManager.getAllRules()).length;
            console.log(`📊 Final database count: ${finalRuleCount} total rules`);
            console.log(`📊 Rules processed in this refresh: ${processedRulesCount}`);
            await this.notificationManager.showRulesRefreshedNotification(processedRulesCount);
            
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

            // Remove the rule files from workspace
            const config = vscode.workspace.getConfiguration('solidrules');
            const rulesDirectory = config.get<string>('rulesDirectory', 'cursorRules');
            
            await this.workspaceManager.removeProjectRule(rule);
            await this.workspaceManager.removeRuleFromWorkspace(rule, rulesDirectory);

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

            // Remove rule files from workspace if active
            if (rule.isActive) {
                const config = vscode.workspace.getConfiguration('solidrules');
                const rulesDirectory = config.get<string>('rulesDirectory', 'cursorRules');
                
                await this.workspaceManager.removeProjectRule(rule);
                await this.workspaceManager.removeRuleFromWorkspace(rule, rulesDirectory);
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
            const maintainLegacyFormat = config.get<boolean>('maintainLegacyFormat', false);

            const workspaceConfig: WorkspaceRuleConfig = {
                workspaceId,
                activeRules: activeRules.map(r => r.id),
                rulesDirectory,
                lastSyncDate: new Date(),
                maintainLegacyFormat
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

    async clearAllData(): Promise<void> {
        try {
            await this.databaseManager.clearAllData();
            this._onDidChangeRules.fire();
        } catch (error) {
            console.error('Failed to clear all data:', error);
            throw error;
        }
    }

    dispose(): void {
        this._onDidChangeRules.dispose();
    }
} 