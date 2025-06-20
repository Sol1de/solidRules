import * as vscode from 'vscode';
import { RulesManager } from '../managers/RulesManager';
import { CursorRule } from '../types';

export class ActiveRulesProvider implements vscode.TreeDataProvider<ActiveRuleTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ActiveRuleTreeItem | undefined | void> = new vscode.EventEmitter<ActiveRuleTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ActiveRuleTreeItem | undefined | void> = this._onDidChangeTreeData.event;

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

    getTreeItem(element: ActiveRuleTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ActiveRuleTreeItem): Promise<ActiveRuleTreeItem[]> {
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
            const activeRules = await this.rulesManager.getActiveRules();
            
            if (activeRules.length === 0) {
                return [new ActiveRuleTreeItem(
                    'No active rules',
                    vscode.TreeItemCollapsibleState.None,
                    'empty',
                    'Click on rules in the explorer to activate them'
                )];
            }

            return activeRules.map(rule => {
                const treeItem = new ActiveRuleTreeItem(
                    rule.name,
                    vscode.TreeItemCollapsibleState.None,
                    'rule-active',
                    this.getRuleDescription(rule),
                    rule
                );

                // Set icon
                if (rule.isFavorite) {
                    treeItem.iconPath = new vscode.ThemeIcon('heart-filled');
                } else if (rule.isCustom) {
                    treeItem.iconPath = new vscode.ThemeIcon('edit');
                } else {
                    treeItem.iconPath = new vscode.ThemeIcon('check');
                }

                // Add command for single click - toggle rule deactivation
                treeItem.command = {
                    command: 'solidrules.toggleRule',
                    title: 'Toggle Rule',
                    arguments: [rule.id]
                };

                // Add visual styling for active rules
                treeItem.resourceUri = vscode.Uri.parse(`rule-active:${rule.id}`);

                return treeItem;
            });

        } catch (error) {
            console.error('Failed to get active rules:', error);
            return [new ActiveRuleTreeItem(
                'Error loading active rules',
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

        if (rule.isCustom) {
            parts.push('Custom');
        }

        return parts.join(' • ');
    }
}

export class ActiveRuleTreeItem extends vscode.TreeItem {
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
                `**${this.rule.name}** (Active)`,
                '',
                this.rule.description || 'No description available',
                '',
                `**Category:** ${this.rule.category}`,
                `**Technologies:** ${this.rule.technologies.join(', ') || 'None'}`,
                `**Tags:** ${this.rule.tags.join(', ') || 'None'}`,
                `**Type:** ${this.rule.isCustom ? 'Custom' : 'GitHub'}`,
                '',
                `**Created:** ${this.rule.createdAt.toLocaleDateString()}`,
                `**Last Updated:** ${this.rule.lastUpdated?.toLocaleDateString() || 'Never'}`,
                '',
                'Right-click to deactivate this rule'
            ];
            return lines.join('\n');
        }

        return this.label;
    }

    iconPath = new vscode.ThemeIcon('check');
} 