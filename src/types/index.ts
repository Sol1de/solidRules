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
}

export interface SearchFilters {
    technology?: string;
    category?: string;
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