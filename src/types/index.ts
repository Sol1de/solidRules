import * as vscode from 'vscode';

export interface CursorRule {
    id: string;
    name: string;
    description: string;
    content: string;
    technologies: string[];
    tags: string[];
    category: string;
    isActive: boolean;
    isFavorite: boolean;
    isCustom: boolean;
    githubPath?: string;
    lastUpdated?: Date | undefined;
    createdAt: Date;
    version?: string | undefined;
}

export interface Technology {
    name: string;
    count: number;
    icon?: string;
}

export interface RuleCategory {
    name: string;
    rules: CursorRule[];
    technologies: Technology[];
}

export interface GitHubRuleInfo {
    path: string;
    name: string;
    sha: string;
    size: number;
    download_url: string;
    type: 'file' | 'dir';
    content?: string;
}

export interface UpdateInfo {
    ruleId: string;
    ruleName: string;
    hasUpdate: boolean;
    currentVersion?: string | undefined;
    latestVersion?: string | undefined;
    lastChecked: Date;
}

export interface WorkspaceRuleConfig {
    workspaceId: string;
    activeRules: string[];
    rulesDirectory: string;
    lastSyncDate?: Date | undefined;
    maintainLegacyFormat?: boolean; // Whether to maintain .cursorrules format alongside new format
}

export interface SearchFilters {
    technology?: string | undefined;
    category?: string | undefined;
    tags?: string[];
    sortBy: 'recent' | 'alphabetical' | 'popularity';
    showFavoritesOnly?: boolean;
    showActiveOnly?: boolean;
}

export interface NotificationOptions {
    message: string;
    actions?: Array<{
        title: string;
        action: () => void | Promise<void>;
    }>;
    isModal?: boolean;
}

export enum RuleStatus {
    INACTIVE = 'inactive',
    ACTIVE = 'active',
    UPDATING = 'updating',
    ERROR = 'error'
}

export interface DatabaseSchema {
    rules: CursorRule;
    workspaces: WorkspaceRuleConfig;
    updates: UpdateInfo;
    favorites: {
        ruleId: string;
        addedAt: Date;
    };
}

// Base TreeItem class for code reuse
export abstract class BaseRuleTreeItem extends vscode.TreeItem {
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

    protected abstract getTooltipPrefix(): string;
    protected getTooltipSuffix(): string {
        return '';
    }

    private getTooltip(): string {
        if (this.rule) {
            const lines = [
                `**${this.rule.name}** ${this.getTooltipPrefix()}`,
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
            
            const suffix = this.getTooltipSuffix();
            if (suffix) {
                lines.push('', suffix);
            }
            
            return lines.join('\n');
        }

        if (this.category) {
            return `Category: ${this.category}\n${this.description || ''}`;
        }

        return this.label;
    }

    iconPath = new vscode.ThemeIcon('file-text');
} 