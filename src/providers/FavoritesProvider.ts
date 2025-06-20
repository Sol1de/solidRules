import * as vscode from 'vscode';
import { RulesManager } from '../managers/RulesManager';
import { CursorRule } from '../types';

export class FavoritesProvider implements vscode.TreeDataProvider<FavoriteRuleTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FavoriteRuleTreeItem | undefined | void> = new vscode.EventEmitter<FavoriteRuleTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<FavoriteRuleTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private rulesManager: RulesManager) {
        // Listen to rules changes with immediate refresh
        this.rulesManager.onDidChangeRules(() => {
            this.refresh();
        });
    }

    refresh(): void {
        // Immediate refresh for better responsiveness
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FavoriteRuleTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: FavoriteRuleTreeItem): Promise<FavoriteRuleTreeItem[]> {
        // Check if GitHub token is configured
        const config = vscode.workspace.getConfiguration('solidrules');
        const githubToken = config.get<string>('githubToken', '');
        
        if (!githubToken) {
            // Hide this panel when token is not configured
            return [];
        }
        
        if (element) {
            return [];
        }

        try {
            const favoriteRules = await this.rulesManager.getFavoriteRules();
            
            if (favoriteRules.length === 0) {
                return [new FavoriteRuleTreeItem(
                    'No favorite rules',
                    vscode.TreeItemCollapsibleState.None,
                    'empty',
                    'Add rules to favorites by right-clicking on them'
                )];
            }

            return favoriteRules.map(rule => {
                const treeItem = new FavoriteRuleTreeItem(
                    rule.name,
                    vscode.TreeItemCollapsibleState.None,
                    'rule-favorite',
                    this.getRuleDescription(rule),
                    rule
                );

                // Set icon based on rule status
                if (rule.isActive) {
                    treeItem.iconPath = new vscode.ThemeIcon('heart-filled');
                } else if (rule.isCustom) {
                    treeItem.iconPath = new vscode.ThemeIcon('star-empty');
                } else {
                    treeItem.iconPath = new vscode.ThemeIcon('heart');
                }

                // Add command for single click - toggle rule activation
                treeItem.command = {
                    command: 'solidrules.toggleRule',
                    title: 'Toggle Rule',
                    arguments: [rule.id]
                };

                // Add visual styling for active rules
                if (rule.isActive) {
                    treeItem.resourceUri = vscode.Uri.parse(`rule-active:${rule.id}`);
                }

                return treeItem;
            });

        } catch (error) {
            console.error('Failed to get favorite rules:', error);
            return [new FavoriteRuleTreeItem(
                'Error loading favorite rules',
                vscode.TreeItemCollapsibleState.None,
                'error'
            )];
        }
    }

    private getRuleDescription(rule: CursorRule): string {
        const parts: string[] = [];
        
        parts.push(rule.category);
        
        if (rule.technologies.length > 0) {
            parts.push(rule.technologies.slice(0, 2).join(', '));
            if (rule.technologies.length > 2) {
                parts[parts.length - 1] += ` +${rule.technologies.length - 2}`;
            }
        }

        if (rule.isActive) {
            parts.push('Active');
        }

        if (rule.isCustom) {
            parts.push('Custom');
        }

        return parts.join(' • ');
    }
}

export class FavoriteRuleTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        description?: string | boolean,
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
                `**${this.rule.name}** ⭐`,
                '',
                this.rule.description || 'No description available',
                '',
                `**Category:** ${this.rule.category}`,
                `**Technologies:** ${this.rule.technologies.join(', ') || 'None'}`,
                `**Tags:** ${this.rule.tags.join(', ') || 'None'}`,
                `**Status:** ${this.rule.isActive ? 'Active' : 'Inactive'}`,
                `**Type:** ${this.rule.isCustom ? 'Custom' : 'GitHub'}`,
                '',
                `**Created:** ${this.rule.createdAt.toLocaleDateString()}`,
                `**Last Updated:** ${this.rule.lastUpdated?.toLocaleDateString() || 'Never'}`,
                '',
                'Right-click to remove from favorites'
            ];
            return lines.join('\n');
        }

        return this.label;
    }

    iconPath = new vscode.ThemeIcon('heart');
} 