import * as vscode from 'vscode';
import { RulesManager } from '../managers/RulesManager';
import { CursorRule, SearchFilters } from '../types';

export class RulesExplorerProvider implements vscode.TreeDataProvider<RuleTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RuleTreeItem | undefined | void> = new vscode.EventEmitter<RuleTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<RuleTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private searchQuery: string = '';
    private currentFilters: SearchFilters = { sortBy: 'recent' };

    constructor(private rulesManager: RulesManager) {
        // Listen to rules changes
        this.rulesManager.onDidChangeRules(() => {
            this.refresh();
        });
    }

    refresh(): void {
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
                const treeItem = new RuleTreeItem(
                    rule.name,
                    vscode.TreeItemCollapsibleState.None,
                    rule.isActive ? 'rule-active' : 'rule-inactive',
                    this.getRuleDescription(rule),
                    undefined,
                    rule
                );

                // Set icon based on rule status
                if (rule.isFavorite) {
                    treeItem.iconPath = new vscode.ThemeIcon('heart-filled');
                } else if (rule.isActive) {
                    treeItem.iconPath = new vscode.ThemeIcon('check');
                } else if (rule.isCustom) {
                    treeItem.iconPath = new vscode.ThemeIcon('edit');
                } else {
                    treeItem.iconPath = new vscode.ThemeIcon('file-text');
                }

                // Add command for double-click
                treeItem.command = {
                    command: 'solidrules.previewRule',
                    title: 'Preview Rule',
                    arguments: [rule.id]
                };

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

export class RuleTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        description?: string | boolean,
        public readonly category?: string,
        public readonly rule?: CursorRule
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.getTooltip();
        if (description !== undefined) {
            this.description = description;
        }
    }

    private getTooltip(): string {
        if (this.rule) {
            const lines = [
                `**${this.rule.name}**`,
                '',
                this.rule.description || 'No description available',
                '',
                `**Category:** ${this.rule.category}`,
                `**Technologies:** ${this.rule.technologies.join(', ') || 'None'}`,
                `**Tags:** ${this.rule.tags.join(', ') || 'None'}`,
                `**Status:** ${this.rule.isActive ? 'Active' : 'Inactive'}`,
                `**Favorite:** ${this.rule.isFavorite ? 'Yes' : 'No'}`,
                `**Type:** ${this.rule.isCustom ? 'Custom' : 'GitHub'}`,
                '',
                `**Created:** ${this.rule.createdAt.toLocaleDateString()}`,
                `**Last Updated:** ${this.rule.lastUpdated?.toLocaleDateString() || 'Never'}`
            ];
            return lines.join('\n');
        }

        if (this.category) {
            return `Category: ${this.category}\n${this.description || ''}`;
        }

        return this.label;
    }

    iconPath = new vscode.ThemeIcon('file-text');
}