import * as vscode from 'vscode';
import { RulesManager } from '../managers/RulesManager';
import { CursorRule, SearchFilters, BaseRuleTreeItem } from '../types';

export class RulesExplorerProvider implements vscode.TreeDataProvider<RuleTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RuleTreeItem | undefined | void> = new vscode.EventEmitter<RuleTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<RuleTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private searchQuery: string = '';
    private currentFilters: SearchFilters = { sortBy: 'recent' };

    constructor(private rulesManager: RulesManager) {
        // Listen to rules changes with immediate refresh for better responsiveness
        this.rulesManager.onDidChangeRules(() => {
            this.refresh();
        });
    }

    refresh(): void {
        // Immediate refresh for better responsiveness during rapid clicks
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: RuleTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RuleTreeItem): Promise<RuleTreeItem[]> {
        // Check if token is configured
        const config = vscode.workspace.getConfiguration('solidrules');
        const hasToken = !!config.get('githubToken');

        if (!hasToken) {
            // Don't show any tree items when no token - the webview will handle the interface
            return [];
        }

        if (!element) {
            // Root level
            if (this.currentFilters.sortBy !== 'recent' || this.searchQuery) {
                return this.getRootItems();
            }
            return this.getRootItems();
        }

        // Child elements
        if (element.contextValue === 'category') {
            return this.getCategoryRules(element.category!);
        }

        return [];
    }

    private async getRootItems(): Promise<RuleTreeItem[]> {
        try {
            const rules = await this.rulesManager.searchRules(this.searchQuery, this.currentFilters);
            console.log(`📊 TreeView getRootItems: Found ${rules.length} total rules`);
            
            if (rules.length === 0) {
                return [new RuleTreeItem(
                    'No rules found',
                    vscode.TreeItemCollapsibleState.None,
                    'empty'
                )];
            }

            // Group by category
            const categoryMap = new Map<string, CursorRule[]>();
            rules.forEach(rule => {
                const category = rule.category || 'Other';
                if (!categoryMap.has(category)) {
                    categoryMap.set(category, []);
                }
                categoryMap.get(category)!.push(rule);
            });

            // Sort categories alphabetically
            const categories = Array.from(categoryMap.keys()).sort();
            
            return categories.map(category => {
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
                
                // Set folder icon for categories
                treeItem.iconPath = new vscode.ThemeIcon('folder');
                
                // Log for debugging
                console.log(`📁 Category ${category}: ${categoryRules.length} rules, ${activeCount} active, ${favoriteCount} favorites`);
                
                return treeItem;
            });

        } catch (error) {
            console.error('Failed to get root items:', error);
            return [new RuleTreeItem(
                'Error loading rules',
                vscode.TreeItemCollapsibleState.None,
                'error'
            )];
        }
    }

    private async getCategoryRules(category: string): Promise<RuleTreeItem[]> {
        try {
            console.log(`🔍 Getting rules for category: ${category}`);
            const allRules = await this.rulesManager.searchRules(this.searchQuery, this.currentFilters);
            const categoryRules = allRules.filter(rule => (rule.category || 'Other') === category);
            console.log(`📋 Found ${categoryRules.length} rules in category ${category}`);

            return categoryRules.map(rule => {
                // Create label with visual indicator for active rules
                const displayName = rule.isActive ? `✓ ${rule.name}` : rule.name;
                const description = rule.isActive ? 
                    `${this.getRuleDescription(rule)} • ACTIVE` : 
                    this.getRuleDescription(rule);

                const treeItem = new RuleTreeItem(
                    displayName,
                    vscode.TreeItemCollapsibleState.None,
                    rule.isActive ? 'rule-active' : 'rule-inactive',
                    description,
                    undefined,
                    rule
                );

                // Set icon based on rule status
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
            console.error(`Failed to get rules for category ${category}:`, error);
            return [];
        }
    }

    private getRuleDescription(rule: CursorRule): string {
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
    }

    async applySearch(query: string): Promise<void> {
        this.searchQuery = query;
        this.refresh();
    }

    async applyFilters(filters: SearchFilters): Promise<void> {
        this.currentFilters = { ...this.currentFilters, ...filters };
        this.refresh();
    }

    async clearFilters(): Promise<void> {
        this.searchQuery = '';
        this.currentFilters = { sortBy: 'recent' };
        this.refresh();
    }

    getCurrentFilters(): SearchFilters {
        return { ...this.currentFilters };
    }

    getSearchQuery(): string {
        return this.searchQuery;
    }
}

export class RuleTreeItem extends BaseRuleTreeItem {
    protected getTooltipPrefix(): string {
        return '';
    }

    iconPath = new vscode.ThemeIcon('file-text');
}