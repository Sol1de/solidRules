import * as vscode from 'vscode';
import { CursorRule, WorkspaceRuleConfig, UpdateInfo } from '../types';

export class DatabaseManager {
    private readonly rulesStorageKey = 'solidrules.rules';
    private readonly workspacesStorageKey = 'solidrules.workspaces';
    private readonly updatesStorageKey = 'solidrules.updates';
    private readonly favoritesStorageKey = 'solidrules.favorites';

    // Enhanced mutex for better concurrency control
    private saveMutex: Promise<void> = Promise.resolve();
    // Note: batchMutex removed as it's not used in current implementation
    // TODO: Implement proper batch operations if needed in the future

    // Performance optimization: cache frequently accessed data  
    // Note: Cache implementation removed for now to reduce complexity
    // TODO: Implement proper caching strategy with invalidation if performance becomes an issue

    constructor(private context: vscode.ExtensionContext) {}

    async initialize(): Promise<void> {
        try {
            // Ensure the directory exists
            await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
            
            // Initialize storage if needed
            if (!this.context.globalState.get(this.rulesStorageKey)) {
                await this.context.globalState.update(this.rulesStorageKey, []);
            }
            if (!this.context.globalState.get(this.workspacesStorageKey)) {
                await this.context.globalState.update(this.workspacesStorageKey, []);
            }
            if (!this.context.globalState.get(this.updatesStorageKey)) {
                await this.context.globalState.update(this.updatesStorageKey, []);
            }
            if (!this.context.globalState.get(this.favoritesStorageKey)) {
                await this.context.globalState.update(this.favoritesStorageKey, []);
            }
            
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    async saveRule(rule: CursorRule): Promise<void> {
        // Use mutex to prevent race conditions with enhanced error handling
        this.saveMutex = this.saveMutex.then(async () => {
            try {
                const rules = await this.getAllRules();
                const existingIndex = rules.findIndex(r => r.id === rule.id);
                
                if (existingIndex >= 0) {
                    rules[existingIndex] = rule;
                } else {
                    rules.push(rule);
                }
                
                await this.context.globalState.update(this.rulesStorageKey, rules);
                console.log(`🔒 Saved rule ${rule.name}, total rules in DB: ${rules.length}`);
            } catch (error) {
                console.error('Failed to save rule:', error);
                throw error;
            }
        });
        
        return this.saveMutex;
    }

    async saveRulesBatch(rules: CursorRule[]): Promise<void> {
        try {
            console.log(`💾 Batch saving ${rules.length} rules...`);
            const existingRules = await this.getAllRules();
            const existingRulesMap = new Map(existingRules.map(r => [r.id, r]));
            
            // Merge new rules with existing ones
            rules.forEach(rule => {
                existingRulesMap.set(rule.id, rule);
            });
            
            const allRules = Array.from(existingRulesMap.values());
            await this.context.globalState.update(this.rulesStorageKey, allRules);
            console.log(`✅ Batch saved ${rules.length} rules, total in DB: ${allRules.length}`);
        } catch (error) {
            console.error('Failed to batch save rules:', error);
            throw error;
        }
    }

    async getAllRules(): Promise<CursorRule[]> {
        try {
            const rules = this.context.globalState.get<any[]>(this.rulesStorageKey, []);
            return rules.map(this.deserializeRule);
        } catch (error) {
            console.error('Failed to get all rules:', error);
            return [];
        }
    }

    async getRuleById(id: string): Promise<CursorRule | null> {
        try {
            const rules = await this.getAllRules();
            return rules.find(rule => rule.id === id) || null;
        } catch (error) {
            console.error('Failed to get rule by id:', error);
            return null;
        }
    }

    async getRulesByTechnology(technology: string): Promise<CursorRule[]> {
        try {
            const rules = await this.getAllRules();
            return rules.filter(rule => 
                rule.technologies.some(tech => 
                    tech.toLowerCase().includes(technology.toLowerCase())
                )
            );
        } catch (error) {
            console.error('Failed to get rules by technology:', error);
            return [];
        }
    }

    async getFavoriteRules(): Promise<CursorRule[]> {
        try {
            const rules = await this.getAllRules();
            return rules.filter(rule => rule.isFavorite);
        } catch (error) {
            console.error('Failed to get favorite rules:', error);
            return [];
        }
    }

    async getActiveRules(): Promise<CursorRule[]> {
        try {
            const rules = await this.getAllRules();
            return rules.filter(rule => rule.isActive);
        } catch (error) {
            console.error('Failed to get active rules:', error);
            return [];
        }
    }

    async updateRuleStatus(ruleId: string, isActive: boolean): Promise<void> {
        try {
            const rule = await this.getRuleById(ruleId);
            if (rule) {
                rule.isActive = isActive;
                await this.saveRule(rule);
            }
        } catch (error) {
            console.error('Failed to update rule status:', error);
            throw error;
        }
    }

    async updateRuleFavorite(ruleId: string, isFavorite: boolean): Promise<void> {
        try {
            const rule = await this.getRuleById(ruleId);
            if (rule) {
                rule.isFavorite = isFavorite;
                await this.saveRule(rule);
                
                // Update favorites list
                const favorites = this.context.globalState.get<any[]>(this.favoritesStorageKey, []);
                if (isFavorite) {
                    if (!favorites.some(f => f.ruleId === ruleId)) {
                        favorites.push({
                            ruleId,
                            addedAt: new Date().toISOString()
                        });
                    }
                } else {
                    const index = favorites.findIndex(f => f.ruleId === ruleId);
                    if (index >= 0) {
                        favorites.splice(index, 1);
                    }
                }
                await this.context.globalState.update(this.favoritesStorageKey, favorites);
            }
        } catch (error) {
            console.error('Failed to update rule favorite:', error);
            throw error;
        }
    }

    async deleteRule(ruleId: string): Promise<void> {
        try {
            const rules = await this.getAllRules();
            const filteredRules = rules.filter(rule => rule.id !== ruleId);
            await this.context.globalState.update(this.rulesStorageKey, filteredRules);
            
            // Remove from favorites
            const favorites = this.context.globalState.get<any[]>(this.favoritesStorageKey, []);
            const filteredFavorites = favorites.filter(f => f.ruleId !== ruleId);
            await this.context.globalState.update(this.favoritesStorageKey, filteredFavorites);
            
            // Remove from updates
            const updates = this.context.globalState.get<any[]>(this.updatesStorageKey, []);
            const filteredUpdates = updates.filter(u => u.ruleId !== ruleId);
            await this.context.globalState.update(this.updatesStorageKey, filteredUpdates);
        } catch (error) {
            console.error('Failed to delete rule:', error);
            throw error;
        }
    }

    async saveWorkspaceConfig(config: WorkspaceRuleConfig): Promise<void> {
        try {
            const workspaces = this.context.globalState.get<WorkspaceRuleConfig[]>(this.workspacesStorageKey, []);
            const existingIndex = workspaces.findIndex(w => w.workspaceId === config.workspaceId);
            
            if (existingIndex >= 0) {
                workspaces[existingIndex] = config;
            } else {
                workspaces.push(config);
            }
            
            await this.context.globalState.update(this.workspacesStorageKey, workspaces);
        } catch (error) {
            console.error('Failed to save workspace config:', error);
            throw error;
        }
    }

    async getWorkspaceConfig(workspaceId: string): Promise<WorkspaceRuleConfig | null> {
        try {
            const workspaces = this.context.globalState.get<any[]>(this.workspacesStorageKey, []);
            const workspaceData = workspaces.find(w => w.workspaceId === workspaceId);
            
            if (workspaceData) {
                const config: WorkspaceRuleConfig = {
                    workspaceId: workspaceData.workspaceId,
                    activeRules: workspaceData.activeRules || [],
                    rulesDirectory: workspaceData.rulesDirectory || 'cursorRules',
                    maintainLegacyFormat: workspaceData.maintainLegacyFormat
                };
                
                // Add lastSyncDate only if it exists (avoiding undefined assignment)
                if (workspaceData.lastSyncDate) {
                    (config as any).lastSyncDate = new Date(workspaceData.lastSyncDate);
                }
                
                return config;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get workspace config:', error);
            return null;
        }
    }

    async saveUpdateInfo(updateInfo: UpdateInfo): Promise<void> {
        try {
            const updates = this.context.globalState.get<any[]>(this.updatesStorageKey, []);
            const existingIndex = updates.findIndex(u => u.ruleId === updateInfo.ruleId);
            
            const serializedUpdate = {
                ...updateInfo,
                lastChecked: updateInfo.lastChecked.toISOString()
            };
            
            if (existingIndex >= 0) {
                updates[existingIndex] = serializedUpdate;
            } else {
                updates.push(serializedUpdate);
            }
            
            await this.context.globalState.update(this.updatesStorageKey, updates);
        } catch (error) {
            console.error('Failed to save update info:', error);
            throw error;
        }
    }

    async getUpdatesInfo(): Promise<UpdateInfo[]> {
        try {
            const updates = this.context.globalState.get<any[]>(this.updatesStorageKey, []);
            return updates.map(update => ({
                ...update,
                lastChecked: new Date(update.lastChecked)
            }));
        } catch (error) {
            console.error('Failed to get updates info:', error);
            return [];
        }
    }

    private deserializeRule(data: any): CursorRule {
        return {
            ...data,
            createdAt: new Date(data.createdAt),
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : undefined,
            technologies: data.technologies || [],
            tags: data.tags || [],
            isActive: Boolean(data.isActive),
            isFavorite: Boolean(data.isFavorite),
            isCustom: Boolean(data.isCustom)
        };
    }

    async searchRules(query: string, filters?: { technology?: string; category?: string }): Promise<CursorRule[]> {
        try {
            let rules = await this.getAllRules();
            
            // Apply text search
            if (query.trim()) {
                const searchTerm = query.toLowerCase().trim();
                rules = rules.filter(rule => 
                    rule.name.toLowerCase().includes(searchTerm) ||
                    rule.description.toLowerCase().includes(searchTerm) ||
                    rule.content.toLowerCase().includes(searchTerm) ||
                    rule.technologies.some(tech => tech.toLowerCase().includes(searchTerm)) ||
                    rule.tags.some(tag => tag.toLowerCase().includes(searchTerm))
                );
            }
            
            // Apply filters
            if (filters?.technology) {
                rules = rules.filter(rule => 
                    rule.technologies.some(tech => 
                        tech.toLowerCase().includes(filters.technology!.toLowerCase())
                    )
                );
            }
            
            if (filters?.category) {
                rules = rules.filter(rule => rule.category === filters.category);
            }
            
            return rules;
        } catch (error) {
            console.error('Failed to search rules:', error);
            return [];
        }
    }

    async clearAllData(): Promise<void> {
        try {
            await this.context.globalState.update(this.rulesStorageKey, []);
            await this.context.globalState.update(this.workspacesStorageKey, []);
            await this.context.globalState.update(this.updatesStorageKey, []);
            await this.context.globalState.update(this.favoritesStorageKey, []);
            console.log('All data cleared successfully');
        } catch (error) {
            console.error('Failed to clear all data:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        // Nothing to close for VSCode storage
    }

    dispose(): void {
        // Nothing to dispose
    }
} 