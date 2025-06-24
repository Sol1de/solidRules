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

    // Performance optimization: batching and debouncing
    private workspaceSyncTimeout: NodeJS.Timeout | undefined;
    private uiRefreshTimeout: NodeJS.Timeout | undefined;
    private pendingFileOperations = new Set<string>();
    private readonly WORKSPACE_SYNC_DELAY = 2000; // 2 seconds debounce
    private readonly UI_REFRESH_DELAY = 100; // 100ms UI debounce

    // High-performance cache for rules by format (major performance boost)
    private rulesByFormatCache: { directoryRules: CursorRule[], fileRules: CursorRule[] } | null = null;
    private rulesCacheTimestamp: number = 0;
    private readonly RULES_CACHE_TTL = 60000; // 1 minute cache TTL for maximum performance

    constructor(
        private databaseManager: DatabaseManager,
        private githubService: GitHubService,
        private notificationManager: NotificationManager,
        private workspaceManager: WorkspaceManager
    ) {}

    // Optimized immediate UI refresh with debouncing and cache invalidation
    private scheduleUIRefresh(): void {
        if (this.uiRefreshTimeout) {
            clearTimeout(this.uiRefreshTimeout);
        }

        this.uiRefreshTimeout = setTimeout(() => {
            // Invalidate rules cache when rules change for data consistency
            this.invalidateRulesCache();
            this._onDidChangeRules.fire();
        }, this.UI_REFRESH_DELAY);
    }

    // High-performance cache invalidation
    private invalidateRulesCache(): void {
        this.rulesByFormatCache = null;
        this.rulesCacheTimestamp = 0;
    }

    // Enhanced workspace sync with intelligent batching
    private scheduleWorkspaceSync(): void {
        if (this.workspaceSyncTimeout) {
            clearTimeout(this.workspaceSyncTimeout);
        }

        this.workspaceSyncTimeout = setTimeout(async () => {
            try {
                if (this.pendingFileOperations.size > 0) {
                    console.log(`📦 Batch syncing ${this.pendingFileOperations.size} file operations...`);
                    await this.optimizedWorkspaceSync();
                    this.pendingFileOperations.clear();
                }
            } catch (error) {
                console.error('Batched workspace sync failed:', error);
            }
        }, this.WORKSPACE_SYNC_DELAY);
    }

    // Ultra-optimized workspace sync with parallel operations
    private async optimizedWorkspaceSync(): Promise<void> {
        const startTime = Date.now();
        
        try {
            const activeRules = await this.databaseManager.getActiveRules();
            const workspaceId = this.workspaceManager.getCurrentWorkspaceId();
            
            if (!workspaceId) {
                console.log('⚠️ No workspace open - skipping sync');
                return;
            }

            // Parallel operations for better performance
            await Promise.all([
                this.cleanupInactiveRulesOptimized(activeRules),
                this.writeActiveRulesOptimized(activeRules)
            ]);
            
            const duration = Date.now() - startTime;
            console.log(`🚀 Optimized workspace sync completed in ${duration}ms - ${activeRules.length} active rules`);
            
        } catch (error) {
            console.error('❌ Optimized workspace sync failed:', error);
            throw error;
        }
    }

    // Optimized cleanup with selective deletion
    private async cleanupInactiveRulesOptimized(activeRules: CursorRule[]): Promise<void> {
        const workspaceId = this.workspaceManager.getCurrentWorkspaceId();
        if (!workspaceId) return;

        try {
            const activeRuleIds = new Set(activeRules.map(r => r.id));
            const config = vscode.workspace.getConfiguration('solidrules');
            const rulesDirectory = config.get<string>('rulesDirectory', 'cursorRules');
            
            // Only process rules that have pending file operations
            const rulesToCleanup = Array.from(this.pendingFileOperations)
                .filter(ruleId => !activeRuleIds.has(ruleId));

            if (rulesToCleanup.length === 0) return;

            // Parallel cleanup operations
            const cleanupPromises = rulesToCleanup.map(async (ruleId) => {
                const rule = await this.databaseManager.getRuleById(ruleId);
                if (rule) {
                    await Promise.all([
                        this.workspaceManager.removeProjectRule(rule),
                        this.workspaceManager.removeRuleFromWorkspace(rule, rulesDirectory)
                    ]);
                }
            });

            await Promise.all(cleanupPromises);
            console.log(`🧹 Cleaned up ${rulesToCleanup.length} inactive rules`);
            
        } catch (error) {
            console.error('Failed to cleanup inactive rules:', error);
        }
    }

    // Optimized write with batch operations
    private async writeActiveRulesOptimized(activeRules: CursorRule[]): Promise<void> {
        const workspaceId = this.workspaceManager.getCurrentWorkspaceId();
        if (!workspaceId || activeRules.length === 0) return;

        try {
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

            // Parallel operations for maximum speed with change detection
            await Promise.all([
                this.databaseManager.saveWorkspaceConfig(workspaceConfig),
                this.workspaceManager.syncActiveRulesOptimized(activeRules, workspaceConfig)
            ]);
            
            console.log(`📝 Optimized write completed - ${activeRules.length} active rules`);
            
        } catch (error) {
            console.error('Failed to write active rules optimized:', error);
        }
    }

    // Ultra-fast rule toggle with immediate feedback
    async ultraFastToggleRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                console.error('Rule not found:', ruleId);
                return;
            }

            // 1. Immediate database update (fastest operation)
            const newStatus = !rule.isActive;
            await this.databaseManager.updateRuleStatus(ruleId, newStatus);
            rule.isActive = newStatus;

            // 2. Immediate UI feedback (perceived performance)
            this.scheduleUIRefresh();

            // 3. Schedule file operations for later (non-blocking)
            this.pendingFileOperations.add(ruleId);
            this.scheduleWorkspaceSync();

            console.log(`⚡ Ultra-fast toggle: ${rule.name} -> ${newStatus ? 'ACTIVE' : 'INACTIVE'}`);
            
        } catch (error) {
            console.error(`Failed to ultra-fast toggle rule ${ruleId}:`, error);
            throw error;
        }
    }

    // Batch toggle for multiple rules (even faster for multiple operations)
    async batchToggleRules(ruleIds: string[]): Promise<void> {
        const startTime = Date.now();
        
        try {
            // 1. Batch database operations
            const rules = await Promise.all(
                ruleIds.map(id => this.databaseManager.getRuleById(id))
            );

            const validRules = rules.filter(r => r !== null) as CursorRule[];
            
            // 2. Parallel status updates
            await Promise.all(
                validRules.map(rule => {
                    const newStatus = !rule.isActive;
                    rule.isActive = newStatus;
                    this.pendingFileOperations.add(rule.id);
                    return this.databaseManager.updateRuleStatus(rule.id, newStatus);
                })
            );

            // 3. Single UI refresh for all changes
            this.scheduleUIRefresh();
            
            // 4. Single workspace sync for all changes
            this.scheduleWorkspaceSync();

            const duration = Date.now() - startTime;
            console.log(`🚀 Batch toggle completed in ${duration}ms - ${validRules.length} rules`);
            
        } catch (error) {
            console.error('Failed to batch toggle rules:', error);
            throw error;
        }
    }

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
            await this.githubService.refreshToken();
            
            // Check if GitHub token is configured using SecretStorage (consistent with GitHubService)
            const githubToken = await this.githubService.getSecureToken();
            
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
                        progress.report({ message: `Loading ${githubRules.length} rules...` });
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
                    const hasToken = !!(await this.githubService.getSecureToken());
                    
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
                    const batchPromises = batch.map(async (githubRule) => {
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
            
            this.scheduleUIRefresh();
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

    async getRulesByFormat(): Promise<{ directoryRules: CursorRule[], fileRules: CursorRule[] }> {
        // High-performance cache check - massive speed improvement!
        const now = Date.now();
        if (this.rulesByFormatCache && (now - this.rulesCacheTimestamp) < this.RULES_CACHE_TTL) {
            console.log(`⚡ Using cached rules by format (${this.rulesByFormatCache.directoryRules.length + this.rulesByFormatCache.fileRules.length} total)`);
            return this.rulesByFormatCache;
        }

        const startTime = Date.now();
        const allRules = await this.databaseManager.getAllRules();
        
        // Optimized rule separation with single pass
        const directoryRules: CursorRule[] = [];
        const fileRules: CursorRule[] = [];
        
        for (const rule of allRules) {
            if (rule.isCustom || (rule.githubPath && rule.githubPath.startsWith('rules/'))) {
                directoryRules.push(rule);
            } else if (rule.githubPath && rule.githubPath.startsWith('rules-new/')) {
                fileRules.push(rule);
            }
        }
        
        const result = { directoryRules, fileRules };
        
        // Cache the result for ultra-fast subsequent calls
        this.rulesByFormatCache = result;
        this.rulesCacheTimestamp = now;
        
        const duration = Date.now() - startTime;
        console.log(`🚀 Generated rules by format in ${duration}ms: ${directoryRules.length} directory, ${fileRules.length} file rules (cached for ${this.RULES_CACHE_TTL/1000}s)`);
        
        return result;
    }

    async activateRule(ruleId: string, showNotification: boolean = true, skipWorkspaceUpdate: boolean = false): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            await this.databaseManager.updateRuleStatus(ruleId, true);
            rule.isActive = true;

            // Skip workspace update for batch operations to improve performance
            if (!skipWorkspaceUpdate) {
                await this.updateWorkspaceRules();
            }
            
            if (showNotification) {
                await this.notificationManager.showRuleActivatedNotification(rule.name);
            }
            
            // Immediate UI update without debouncing for better responsiveness
            this.scheduleUIRefresh();
        } catch (error) {
            console.error(`Failed to activate rule ${ruleId}:`, error);
            if (showNotification) {
                await this.notificationManager.showErrorMessage(`Failed to activate rule: ${error}`);
            }
            throw error;
        }
    }

    async deactivateRule(ruleId: string, showNotification: boolean = true, skipWorkspaceUpdate: boolean = false): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            await this.databaseManager.updateRuleStatus(ruleId, false);
            rule.isActive = false;

            // Skip workspace file operations for batch operations to improve performance
            if (!skipWorkspaceUpdate) {
                // Remove the rule files from workspace
                const config = vscode.workspace.getConfiguration('solidrules');
                const rulesDirectory = config.get<string>('rulesDirectory', 'cursorRules');
                
                await this.workspaceManager.removeProjectRule(rule);
                await this.workspaceManager.removeRuleFromWorkspace(rule, rulesDirectory);

                await this.updateWorkspaceRules();
            }
            
            if (showNotification) {
                await this.notificationManager.showRuleDeactivatedNotification(rule.name);
            }
            
            // Immediate UI update without debouncing for better responsiveness
            this.scheduleUIRefresh();
        } catch (error) {
            console.error(`Failed to deactivate rule ${ruleId}:`, error);
            if (showNotification) {
                await this.notificationManager.showErrorMessage(`Failed to deactivate rule: ${error}`);
            }
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
            
            this.scheduleUIRefresh();
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
            
            this.scheduleUIRefresh();
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
            
            this.scheduleUIRefresh();
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
                        lastChecked: new Date(),
                        ...(rule.version && { currentVersion: rule.version })
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
            // Create new rule object with updated content but keeping original properties
            const ruleWithUpdates: CursorRule = {
                ...updatedRule,
                id: rule.id,
                isActive: rule.isActive,
                isFavorite: rule.isFavorite,
                lastUpdated: new Date()
            };

            await this.databaseManager.saveRule(ruleWithUpdates);
            
            if (rule.isActive) {
                await this.updateWorkspaceRules();
            }
            
            this.scheduleUIRefresh();
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

    async batchUpdateWorkspace(): Promise<void> {
        console.log('🔄 Batch updating workspace...');
        await this.updateWorkspaceRules();
        console.log('✅ Workspace batch update completed');
    }

    // Ultra-fast methods that only update database state
    async fastActivateRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            // Only update database state - no file operations
            await this.databaseManager.updateRuleStatus(ruleId, true);
            rule.isActive = true;
            
            // Immediate UI refresh only
            this.scheduleUIRefresh();
        } catch (error) {
            console.error(`Failed to fast activate rule ${ruleId}:`, error);
            throw error;
        }
    }

    async fastDeactivateRule(ruleId: string): Promise<void> {
        try {
            const rule = await this.databaseManager.getRuleById(ruleId);
            if (!rule) {
                throw new Error('Rule not found');
            }

            // Only update database state - no file operations
            await this.databaseManager.updateRuleStatus(ruleId, false);
            rule.isActive = false;
            
            // Immediate UI refresh only
            this.scheduleUIRefresh();
        } catch (error) {
            console.error(`Failed to fast deactivate rule ${ruleId}:`, error);
            throw error;
        }
    }

    // Lazy workspace synchronization method
    async syncWorkspaceFiles(): Promise<void> {
        try {
            const activeRules = await this.databaseManager.getActiveRules();
            
            // Clean up all existing rule files first
            await this.cleanupAllRuleFiles();
            
            // Only write files for currently active rules
            if (activeRules.length > 0) {
                await this.writeActiveRulesToWorkspace(activeRules);
            }
            
            console.log(`📁 Synchronized ${activeRules.length} active rules to workspace`);
        } catch (error) {
            console.error('Failed to sync workspace files:', error);
            throw error;
        }
    }

    private async cleanupAllRuleFiles(): Promise<void> {
        const workspaceId = this.workspaceManager.getCurrentWorkspaceId();
        if (!workspaceId) {
            return;
        }

        try {
            // Get all rules to clean up their files
            const allRules = await this.databaseManager.getAllRules();
            const config = vscode.workspace.getConfiguration('solidrules');
            const rulesDirectory = config.get<string>('rulesDirectory', 'cursorRules');
            
            // Remove all rule files (both active and inactive)
            for (const rule of allRules) {
                await this.workspaceManager.removeProjectRule(rule);
                await this.workspaceManager.removeRuleFromWorkspace(rule, rulesDirectory);
            }
            
            console.log(`🧹 Cleaned up ${allRules.length} rule files from workspace`);
        } catch (error) {
            console.error('Failed to cleanup rule files:', error);
        }
    }

    private async writeActiveRulesToWorkspace(activeRules: CursorRule[]): Promise<void> {
        const workspaceId = this.workspaceManager.getCurrentWorkspaceId();
        if (!workspaceId) {
            return;
        }

        try {
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
            
            console.log(`📝 Wrote ${activeRules.length} active rules to workspace`);
        } catch (error) {
            console.error('Failed to write active rules to workspace:', error);
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

    // Provide access to GitHubService for secure token management
    getGitHubService(): GitHubService {
        return this.githubService;
    }

    async clearAllData(): Promise<void> {
        try {
            await this.databaseManager.clearAllData();
            this.scheduleUIRefresh();
        } catch (error) {
            console.error('Failed to clear all data:', error);
            throw error;
        }
    }

    dispose(): void {
        // Clean up timeouts
        if (this.workspaceSyncTimeout) {
            clearTimeout(this.workspaceSyncTimeout);
        }
        if (this.uiRefreshTimeout) {
            clearTimeout(this.uiRefreshTimeout);
        }
        
        // Clear cache
        this.pendingFileOperations.clear();
        
        // Dispose event emitter
        this._onDidChangeRules.dispose();
    }
} 