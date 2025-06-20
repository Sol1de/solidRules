import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CursorRule, WorkspaceRuleConfig, UpdateInfo } from '../types';

export class DatabaseManager {
    private rulesStorageKey = 'solidrules.rules';
    private workspacesStorageKey = 'solidrules.workspaces';
    private updatesStorageKey = 'solidrules.updates';
    private favoritesStorageKey = 'solidrules.favorites';
    
    private dbPath: string;

    constructor(private context: vscode.ExtensionContext) {
        this.dbPath = path.join(context.globalStorageUri.fsPath, 'solidrules-data.json');
    }

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
        try {
            const rules = await this.getAllRules();
            const existingIndex = rules.findIndex(r => r.id === rule.id);
            
            if (existingIndex >= 0) {
                rules[existingIndex] = rule;
            } else {
                rules.push(rule);
            }
            
            await this.context.globalState.update(this.rulesStorageKey, rules);
        } catch (error) {
            console.error('Failed to save rule:', error);
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
            const workspaces = this.context.globalState.get<any[]>(this.workspacesStorageKey, []);
            const existingIndex = workspaces.findIndex(w => w.workspaceId === config.workspaceId);
            
            const serializedConfig = {
                workspaceId: config.workspaceId,
                activeRules: config.activeRules,
                rulesDirectory: config.rulesDirectory,
                lastSyncDate: config.lastSyncDate?.toISOString()
            };
            
            if (existingIndex >= 0) {
                workspaces[existingIndex] = serializedConfig;
            } else {
                workspaces.push(serializedConfig);
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
            const workspace = workspaces.find(w => w.workspaceId === workspaceId);
            
            if (!workspace) return null;
            
            return {
                workspaceId: workspace.workspaceId,
                activeRules: workspace.activeRules || [],
                rulesDirectory: workspace.rulesDirectory,
                lastSyncDate: workspace.lastSyncDate ? new Date(workspace.lastSyncDate) : undefined
            };
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
                ruleId: updateInfo.ruleId,
                ruleName: updateInfo.ruleName,
                hasUpdate: updateInfo.hasUpdate,
                currentVersion: updateInfo.currentVersion,
                latestVersion: updateInfo.latestVersion,
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
            return updates
                .filter(u => u.hasUpdate)
                .map(u => ({
                    ruleId: u.ruleId,
                    ruleName: u.ruleName,
                    hasUpdate: u.hasUpdate,
                    currentVersion: u.currentVersion,
                    latestVersion: u.latestVersion,
                    lastChecked: new Date(u.lastChecked)
                }));
        } catch (error) {
            console.error('Failed to get updates info:', error);
            return [];
        }
    }

    private deserializeRule(data: any): CursorRule {
        return {
            id: data.id,
            name: data.name,
            description: data.description,
            content: data.content,
            technologies: data.technologies || [],
            tags: data.tags || [],
            category: data.category,
            isActive: data.isActive || false,
            isFavorite: data.isFavorite || false,
            isCustom: data.isCustom || false,
            githubPath: data.githubPath,
            lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : undefined,
            createdAt: new Date(data.createdAt),
            version: data.version
        };
    }

    async searchRules(query: string, filters?: { technology?: string; category?: string }): Promise<CursorRule[]> {
        try {
            const rules = await this.getAllRules();
            
            let filteredRules = rules.filter(rule => {
                const searchText = `${rule.name} ${rule.description} ${rule.content}`.toLowerCase();
                return searchText.includes(query.toLowerCase());
            });

            if (filters?.technology) {
                filteredRules = filteredRules.filter(rule =>
                    rule.technologies.some(tech =>
                        tech.toLowerCase().includes(filters.technology!.toLowerCase())
                    )
                );
            }

            if (filters?.category) {
                filteredRules = filteredRules.filter(rule => rule.category === filters.category);
            }

            return filteredRules.sort((a, b) => 
                (b.lastUpdated || b.createdAt).getTime() - (a.lastUpdated || a.createdAt).getTime()
            );
        } catch (error) {
            console.error('Failed to search rules:', error);
            return [];
        }
    }

    async clearAllData(): Promise<void> {
        try {
            // Clear all stored data
            await this.context.globalState.update(this.rulesStorageKey, []);
            await this.context.globalState.update(this.workspacesStorageKey, []);
            await this.context.globalState.update(this.updatesStorageKey, []);
            await this.context.globalState.update(this.favoritesStorageKey, []);
            
            console.log('🗑️ All database data cleared successfully');
        } catch (error) {
            console.error('Failed to clear database:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        // No cleanup needed for VSCode storage
        return Promise.resolve();
    }

    dispose(): void {
        // No cleanup needed for VSCode storage
    }
} 