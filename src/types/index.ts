import * as vscode from 'vscode';

// Enhanced CursorRule interface with strict types
export interface CursorRule {
    readonly id: string;
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
    lastUpdated?: Date;
    readonly createdAt: Date;
    version?: string;
}

// Enhanced Technology interface
export interface Technology {
    readonly name: string;
    readonly count: number;
    readonly icon?: string;
}

// Enhanced RuleCategory interface with better typing
export interface RuleCategory {
    readonly name: string;
    readonly rules: ReadonlyArray<CursorRule>;
    readonly technologies: ReadonlyArray<Technology>;
}

// Enhanced GitHubRuleInfo interface
export interface GitHubRuleInfo {
    readonly path: string;
    readonly name: string;
    readonly sha: string;
    readonly size: number;
    readonly download_url: string;
    readonly type: 'file' | 'dir';
    readonly format?: 'directory' | 'file';
    readonly content?: string;
}

// Enhanced UpdateInfo interface
export interface UpdateInfo {
    readonly ruleId: string;
    readonly ruleName: string;
    readonly hasUpdate: boolean;
    readonly currentVersion?: string | undefined;
    readonly latestVersion?: string | undefined;
    readonly lastChecked: Date;
}

// Enhanced WorkspaceRuleConfig interface
export interface WorkspaceRuleConfig {
    readonly workspaceId: string;
    readonly activeRules: ReadonlyArray<string>;
    readonly rulesDirectory: string;
    readonly lastSyncDate?: Date | undefined;
    readonly maintainLegacyFormat?: boolean | undefined;
}

// Enhanced SearchFilters interface with better defaults
export interface SearchFilters {
    readonly technology?: string | undefined;
    readonly category?: string | undefined;
    readonly tags?: ReadonlyArray<string> | undefined;
    readonly sortBy: 'recent' | 'alphabetical' | 'popularity';
    readonly showFavoritesOnly?: boolean | undefined;
    readonly showActiveOnly?: boolean | undefined;
}

// Enhanced NotificationOptions interface
export interface NotificationOptions {
    readonly message: string;
    readonly actions?: ReadonlyArray<{
        readonly title: string;
        readonly action: () => void | Promise<void>;
    }>;
    readonly isModal?: boolean;
}

// Enhanced RuleStatus enum with better typing
export enum RuleStatus {
    INACTIVE = 'inactive',
    ACTIVE = 'active',
    UPDATING = 'updating',
    ERROR = 'error'
}

// Enhanced DatabaseSchema interface for better type safety
export interface DatabaseSchema {
    readonly rules: CursorRule;
    readonly workspaces: WorkspaceRuleConfig;
    readonly updates: UpdateInfo;
    readonly favorites: {
        readonly ruleId: string;
        readonly addedAt: Date;
    };
}

// New interfaces for better architecture

// Performance monitoring interface
export interface PerformanceMetrics {
    readonly operationName: string;
    readonly startTime: number;
    readonly endTime: number;
    readonly duration: number;
    readonly success: boolean;
    readonly errorMessage?: string;
}

// Enhanced error handling interface
export interface SolidRulesError {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly timestamp: Date;
    readonly stack?: string;
}

// Configuration interface for better type safety
export interface SolidRulesConfig {
    readonly githubToken?: string;
    readonly rulesDirectory: string;
    readonly enableNotifications: boolean;
    readonly maintainLegacyFormat: boolean;
    readonly autoSync: boolean;
    readonly syncInterval: number;
    readonly performanceLogging: boolean;
}

// Manager interface for dependency injection pattern
export interface ManagerInterface {
    initialize(): Promise<void>;
    dispose(): void;
}

// Service interface for consistent service architecture
export interface ServiceInterface {
    readonly isInitialized: boolean;
    initialize(): Promise<void>;
    dispose(): void;
}

// Enhanced TreeItem interface with strict typing
export interface RuleTreeItemData {
    readonly rule?: CursorRule;
    readonly category?: string;
    readonly contextValue: string;
    readonly isExpandable: boolean;
}

// Event data interfaces for better event handling
export interface RuleChangeEvent {
    readonly type: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
    readonly ruleId: string;
    readonly ruleName: string;
    readonly timestamp: Date;
    readonly metadata?: Record<string, unknown>;
}

export interface WorkspaceChangeEvent {
    readonly type: 'sync' | 'cleanup' | 'error';
    readonly workspaceId: string;
    readonly affectedRules: ReadonlyArray<string>;
    readonly timestamp: Date;
    readonly duration?: number;
}

// Base TreeItem class with enhanced typing and error handling
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
        
        try {
            this.tooltip = this.generateTooltip();
            if (description !== undefined) {
                this.description = description;
            }
            this.iconPath = this.getIcon();
        } catch (error) {
            console.error('❌ Error initializing TreeItem:', error);
            this.tooltip = `Error: ${error}`;
            this.iconPath = new vscode.ThemeIcon('error');
        }
    }

    protected abstract getTooltipPrefix(): string;
    
    protected getTooltipSuffix(): string {
        return '';
    }

    private generateTooltip(): string {
        try {
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
        } catch (error) {
            console.error('❌ Error generating tooltip:', error);
            return `${this.label} (Error generating tooltip)`;
        }
    }

    private getIcon(): vscode.ThemeIcon {
        try {
            if (this.rule) {
                if (this.rule.isFavorite) {
                    return new vscode.ThemeIcon('heart-filled');
                } else if (this.rule.isActive) {
                    return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
                } else if (this.rule.isCustom) {
                    return new vscode.ThemeIcon('edit');
                }
            }
            
            if (this.contextValue === 'category') {
                return new vscode.ThemeIcon('folder');
            }
            
            return new vscode.ThemeIcon('file-text');
        } catch (error) {
            console.error('❌ Error getting icon:', error);
            return new vscode.ThemeIcon('error');
        }
    }
} 