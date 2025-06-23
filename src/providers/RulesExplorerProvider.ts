import * as vscode from 'vscode';
import { RulesManager } from '../managers/RulesManager';
import { CursorRule, SearchFilters, BaseRuleTreeItem } from '../types';

export class RulesExplorerProvider implements vscode.TreeDataProvider<RuleTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RuleTreeItem | undefined | void> = new vscode.EventEmitter<RuleTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<RuleTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    // Enhanced state management
    private searchQuery: string = '';
    private currentFilters: SearchFilters = { sortBy: 'recent' };
    
    // Performance optimization: caching with TTL
    private categoriesCache: Map<string, RuleTreeItem[]> = new Map();
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL = 30000; // 30 seconds TTL for cache
    private readonly MAX_CACHE_SIZE = 100; // Limit cache size for memory efficiency

    // Debounced refresh for better performance
    private refreshTimeout: NodeJS.Timeout | undefined;
    private readonly REFRESH_DEBOUNCE = 50; // 50ms debounce

    constructor(private rulesManager: RulesManager) {
        // Listen to rules changes with debounced refresh for better performance
        this.rulesManager.onDidChangeRules(() => {
            this.scheduleRefresh();
        });
    }

    // Debounced refresh to prevent excessive UI updates
    private scheduleRefresh(): void {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        
        this.refreshTimeout = setTimeout(() => {
            this.invalidateCache();
            this._onDidChangeTreeData.fire();
        }, this.REFRESH_DEBOUNCE);
    }

    // Manual refresh for user-triggered updates
    refresh(): void {
        try {
            this.invalidateCache();
            this._onDidChangeTreeData.fire();
        } catch (error) {
            console.error('❌ Error during refresh:', error);
        }
    }

    // Cache management
    private invalidateCache(): void {
        this.categoriesCache.clear();
        this.cacheTimestamp = 0;
    }

    private isCacheValid(): boolean {
        return Date.now() - this.cacheTimestamp < this.CACHE_TTL;
    }

    private getCachedCategories(): RuleTreeItem[] | null {
        if (!this.isCacheValid()) {
            return null;
        }
        
        const cacheKey = this.generateCacheKey();
        return this.categoriesCache.get(cacheKey) || null;
    }

    private setCachedCategories(categories: RuleTreeItem[]): void {
        const cacheKey = this.generateCacheKey();
        
        // Implement LRU cache by removing oldest entries
        if (this.categoriesCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.categoriesCache.keys().next().value;
            if (firstKey !== undefined) {
                this.categoriesCache.delete(firstKey);
            }
        }
        
        this.categoriesCache.set(cacheKey, categories);
        this.cacheTimestamp = Date.now();
    }

    private generateCacheKey(): string {
        return `${this.searchQuery}|${JSON.stringify(this.currentFilters)}`;
    }

    getTreeItem(element: RuleTreeItem): vscode.TreeItem {
        try {
            return element;
        } catch (error) {
            console.error('❌ Error getting tree item:', error);
            return new RuleTreeItem(
                'Error',
                vscode.TreeItemCollapsibleState.None,
                'error',
                'Error loading item'
            );
        }
    }

    async getChildren(element?: RuleTreeItem): Promise<RuleTreeItem[]> {
        try {
            // Check if token is configured using secure storage
            const githubService = this.rulesManager.getGitHubService();
            const hasToken = !!(await githubService.getSecureToken());

            if (!hasToken) {
                // Don't show any tree items when no token - the webview will handle the interface
                return [];
            }

            if (!element) {
                // Root level - show categories with caching
                return await this.getMergedCategories();
            }
            
            if (element.contextValue === 'category') {
                return await this.getMergedCategoryRules(element.category!);
            }

            return [];
        } catch (error) {
            console.error('❌ Error getting children:', error);
            return [new RuleTreeItem(
                'Error loading rules',
                vscode.TreeItemCollapsibleState.None,
                'error',
                `Error: ${error}`
            )];
        }
    }

    private async getMergedCategories(): Promise<RuleTreeItem[]> {
        try {
            // Check cache first
            const cached = this.getCachedCategories();
            if (cached) {
                return cached;
            }

            const { directoryRules, fileRules } = await this.rulesManager.getRulesByFormat();
            const allRules = [...directoryRules, ...fileRules];
            
            if (allRules.length === 0) {
                return [new RuleTreeItem(
                    'No rules found',
                    vscode.TreeItemCollapsibleState.None,
                    'empty',
                    'Try refreshing or configuring a GitHub token'
                )];
            }

            // Apply search and filters
            const filteredRules = this.applyFiltersToRules(allRules);

            // Group by category (merge both formats)
            const categoryMap = new Map<string, CursorRule[]>();
            filteredRules.forEach(rule => {
                const category = rule.category || 'Other';
                if (!categoryMap.has(category)) {
                    categoryMap.set(category, []);
                }
                categoryMap.get(category)!.push(rule);
            });

            // Sort categories alphabetically
            const categories = Array.from(categoryMap.keys()).sort();
            
            const categoryItems = categories.map(category => {
                const categoryRules = categoryMap.get(category)!;
                const activeCount = categoryRules.filter(r => r.isActive).length;
                const favoriteCount = categoryRules.filter(r => r.isFavorite).length;
                
                let description = `${categoryRules.length} rules`;
                if (activeCount > 0) {
                    description += ` • ${activeCount} active`;
                }
                if (favoriteCount > 0) {
                    description += ` • ${favoriteCount} favorites`;
                }

                const treeItem = new RuleTreeItem(
                    category,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'category',
                    description,
                    category
                );
                
                treeItem.iconPath = new vscode.ThemeIcon('folder');
                
                return treeItem;
            });

            // Cache the results
            this.setCachedCategories(categoryItems);
            
            console.log(`📁 Generated ${categoryItems.length} merged categories with ${filteredRules.length} rules`);
            
            return categoryItems;

        } catch (error) {
            console.error('❌ Failed to get merged categories:', error);
            return [new RuleTreeItem(
                'Error loading categories',
                vscode.TreeItemCollapsibleState.None,
                'error',
                `Error: ${error}`
            )];
        }
    }

    private async getMergedCategoryRules(category: string): Promise<RuleTreeItem[]> {
        try {
            console.log(`🔍 Getting merged rules for category: ${category}`);
            
            const { directoryRules, fileRules } = await this.rulesManager.getRulesByFormat();
            const allRules = [...directoryRules, ...fileRules];
            const categoryRules = allRules.filter(rule => (rule.category || 'Other') === category);
            
            // Apply search and filters
            const filteredRules = this.applyFiltersToRules(categoryRules);
            
            console.log(`📋 Found ${filteredRules.length} merged rules in category ${category}`);
            return this.createRuleTreeItems(filteredRules);
            
        } catch (error) {
            console.error(`❌ Failed to get merged rules for category ${category}:`, error);
            return [new RuleTreeItem(
                'Error loading rules',
                vscode.TreeItemCollapsibleState.None,
                'error',
                `Error: ${error}`
            )];
        }
    }

    // Enhanced filtering logic
    private applyFiltersToRules(rules: CursorRule[]): CursorRule[] {
        let filteredRules = [...rules];

        try {
            // Apply search query
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                filteredRules = filteredRules.filter(rule =>
                    rule.name.toLowerCase().includes(query) ||
                    rule.description.toLowerCase().includes(query) ||
                    rule.technologies.some(tech => tech.toLowerCase().includes(query)) ||
                    rule.tags.some(tag => tag.toLowerCase().includes(query))
                );
            }

            // Apply filters
            if (this.currentFilters.technology) {
                const technologyFilter = this.currentFilters.technology.toLowerCase();
                filteredRules = filteredRules.filter(rule =>
                    rule.technologies.some(tech =>
                        tech.toLowerCase().includes(technologyFilter)
                    )
                );
            }

            if (this.currentFilters.category) {
                const categoryFilter = this.currentFilters.category.toLowerCase();
                filteredRules = filteredRules.filter(rule =>
                    rule.category.toLowerCase() === categoryFilter
                );
            }

            if (this.currentFilters.showFavoritesOnly) {
                filteredRules = filteredRules.filter(rule => rule.isFavorite);
            }

            if (this.currentFilters.showActiveOnly) {
                filteredRules = filteredRules.filter(rule => rule.isActive);
            }

            // Apply sorting
            return this.sortRules(filteredRules, this.currentFilters.sortBy);

        } catch (error) {
            console.error('❌ Error applying filters:', error);
            return rules; // Return unfiltered on error
        }
    }

    private sortRules(rules: CursorRule[], sortBy: 'recent' | 'alphabetical' | 'popularity'): CursorRule[] {
        try {
            switch (sortBy) {
                case 'recent':
                    return rules.sort((a, b) => {
                        const dateA = a.lastUpdated || a.createdAt;
                        const dateB = b.lastUpdated || b.createdAt;
                        return dateB.getTime() - dateA.getTime();
                    });
                case 'alphabetical':
                    return rules.sort((a, b) => a.name.localeCompare(b.name));
                case 'popularity':
                    return rules.sort((a, b) => {
                        // Sort by favorites first, then by active status
                        if (a.isFavorite !== b.isFavorite) {
                            return b.isFavorite ? 1 : -1;
                        }
                        if (a.isActive !== b.isActive) {
                            return b.isActive ? 1 : -1;
                        }
                        return a.name.localeCompare(b.name);
                    });
                default:
                    return rules;
            }
        } catch (error) {
            console.error('❌ Error sorting rules:', error);
            return rules; // Return unsorted on error
        }
    }

    private createRuleTreeItems(rules: CursorRule[]): RuleTreeItem[] {
        try {
            return rules.map(rule => {
                // Simple display name without redundant visual indicators
                const displayName = rule.name;
                const description = this.getRuleDescription(rule);

                const treeItem = new RuleTreeItem(
                    displayName,
                    vscode.TreeItemCollapsibleState.None,
                    rule.isActive ? 'rule-active' : 'rule-inactive',
                    description,
                    undefined,
                    rule
                );

                // Set icon based on rule status - this is the main visual indicator
                if (rule.isFavorite) {
                    treeItem.iconPath = new vscode.ThemeIcon('heart-filled');
                } else if (rule.isActive) {
                    treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
                } else if (rule.isCustom) {
                    treeItem.iconPath = new vscode.ThemeIcon('edit');
                } else {
                    treeItem.iconPath = new vscode.ThemeIcon('file-text');
                }

                // Add command for single click - toggle rule activation
                treeItem.command = {
                    command: 'solidrules.toggleRule',
                    title: 'Toggle Rule',
                    arguments: [rule.id]
                };

                // Add visual styling for active rules using resourceUri
                if (rule.isActive) {
                    treeItem.resourceUri = vscode.Uri.parse(`rule-active:${rule.id}`);
                }

                return treeItem;
            });
        } catch (error) {
            console.error('❌ Error creating rule tree items:', error);
            return [new RuleTreeItem(
                'Error creating items',
                vscode.TreeItemCollapsibleState.None,
                'error',
                `Error: ${error}`
            )];
        }
    }

    private getRuleDescription(rule: CursorRule): string {
        try {
            const parts: string[] = [];
            
            if (rule.technologies.length > 0) {
                parts.push(rule.technologies.slice(0, 3).join(', '));
                if (rule.technologies.length > 3) {
                    parts[parts.length - 1] += ` +${rule.technologies.length - 3}`;
                }
            }

            if (rule.isCustom) {
                parts.push('Custom');
            }

            const lastUpdated = this.rulesManager.formatLastUpdated(rule.lastUpdated);
            if (lastUpdated !== 'Never') {
                parts.push(`Updated ${lastUpdated}`);
            }

            return parts.join(' • ');
        } catch (error) {
            console.error('❌ Error getting rule description:', error);
            return 'Error getting description';
        }
    }

    async applySearch(query: string): Promise<void> {
        try {
            this.searchQuery = query;
            this.invalidateCache();
            this.refresh();
        } catch (error) {
            console.error('❌ Error applying search:', error);
        }
    }

    async applyFilters(filters: SearchFilters): Promise<void> {
        try {
            this.currentFilters = { ...filters };
            this.invalidateCache();
            this.refresh();
        } catch (error) {
            console.error('❌ Error applying filters:', error);
        }
    }

    async clearFilters(): Promise<void> {
        try {
            this.searchQuery = '';
            this.currentFilters = { sortBy: 'recent' };
            this.invalidateCache();
            this.refresh();
        } catch (error) {
            console.error('❌ Error clearing filters:', error);
        }
    }

    getCurrentFilters(): SearchFilters {
        return { ...this.currentFilters };
    }

    getSearchQuery(): string {
        return this.searchQuery;
    }

    // Cleanup resources on disposal
    dispose(): void {
        try {
            if (this.refreshTimeout) {
                clearTimeout(this.refreshTimeout);
            }
            this.invalidateCache();
            this._onDidChangeTreeData.dispose();
        } catch (error) {
            console.error('❌ Error during disposal:', error);
        }
    }
}

export class RuleTreeItem extends BaseRuleTreeItem {
    protected getTooltipPrefix(): string {
        return this.rule?.isActive ? '(Active)' : '(Inactive)';
    }
}