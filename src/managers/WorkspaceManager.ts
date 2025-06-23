import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CursorRule, WorkspaceRuleConfig } from '../types';

export class WorkspaceManager {
    private readonly CURSOR_RULES_FILE = '.cursorrules'; // Legacy support
    private readonly PROJECT_RULES_DIR = '.cursor/rules';
    
    // Performance optimization: cache for avoiding unnecessary file operations
    private lastSyncedRules = new Map<string, string>(); // ruleId -> content hash
    private readonly SYNC_CACHE_SIZE = 100; // Limit cache size

    // Performance: Cache content hashes to avoid unnecessary writes
    private generateContentHash(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    getCurrentWorkspaceId(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }
        return workspaceFolder.uri.fsPath;
    }

    getCurrentWorkspaceName(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return 'No Workspace';
        }
        return workspaceFolder.name;
    }

    async createCursorRulesDirectory(rulesDirectory: string = 'cursorRules'): Promise<string | null> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            throw new Error('No workspace is currently open');
        }

        const rulesPath = path.join(workspaceId, rulesDirectory);
        
        try {
            await fs.mkdir(rulesPath, { recursive: true });
            return rulesPath;
        } catch (error) {
            console.error('Failed to create cursor rules directory:', error);
            throw error;
        }
    }

    async createProjectRulesDirectory(): Promise<string | null> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            throw new Error('No workspace is currently open');
        }

        const rulesPath = path.join(workspaceId, this.PROJECT_RULES_DIR);
        
        try {
            await fs.mkdir(rulesPath, { recursive: true });
            return rulesPath;
        } catch (error) {
            console.error('Failed to create project rules directory:', error);
            throw error;
        }
    }

    async writeRuleToWorkspace(rule: CursorRule, rulesDirectory: string = 'cursorRules'): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            throw new Error('No workspace is currently open');
        }

        const rulesPath = await this.createCursorRulesDirectory(rulesDirectory);
        if (!rulesPath) {
            throw new Error('Failed to create rules directory');
        }

        const ruleFileName = `${this.sanitizeFileName(rule.name)}.cursorrules`;
        const ruleFilePath = path.join(rulesPath, ruleFileName);

        const content = this.formatRuleContent(rule);
        
        try {
            await fs.writeFile(ruleFilePath, content, 'utf-8');
        } catch (error) {
            console.error(`Failed to write rule ${rule.name} to workspace:`, error);
            throw error;
        }
    }

    async writeProjectRule(rule: CursorRule): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            throw new Error('No workspace is currently open');
        }

        const rulesPath = await this.createProjectRulesDirectory();
        if (!rulesPath) {
            throw new Error('Failed to create project rules directory');
        }

        const ruleFileName = `${this.sanitizeFileName(rule.name)}.mdc`;
        const ruleFilePath = path.join(rulesPath, ruleFileName);

        const content = this.formatProjectRuleContent(rule);
        
        try {
            await fs.writeFile(ruleFilePath, content, 'utf-8');
        } catch (error) {
            console.error(`Failed to write project rule ${rule.name}:`, error);
            throw error;
        }
    }

    async removeRuleFromWorkspace(rule: CursorRule, rulesDirectory: string = 'cursorRules'): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            throw new Error('No workspace is currently open');
        }

        const rulesPath = path.join(workspaceId, rulesDirectory);
        const ruleFileName = `${this.sanitizeFileName(rule.name)}.cursorrules`;
        const ruleFilePath = path.join(rulesPath, ruleFileName);

        try {
            await fs.unlink(ruleFilePath);
        } catch (error) {
            // File might not exist, which is fine
            console.log(`Rule file ${ruleFileName} not found, skipping removal`);
        }
    }

    async removeProjectRule(rule: CursorRule): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            throw new Error('No workspace is currently open');
        }

        const rulesPath = path.join(workspaceId, this.PROJECT_RULES_DIR);
        const ruleFileName = `${this.sanitizeFileName(rule.name)}.mdc`;
        const ruleFilePath = path.join(rulesPath, ruleFileName);

        try {
            await fs.unlink(ruleFilePath);
        } catch (error) {
            // File might not exist, which is fine
            console.log(`Project rule file ${ruleFileName} not found, skipping removal`);
        }
    }

    async generateMasterCursorRulesFile(activeRules: CursorRule[]): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            throw new Error('No workspace is currently open');
        }

        const masterFilePath = path.join(workspaceId, this.CURSOR_RULES_FILE);
        
        if (activeRules.length === 0) {
            // Remove the master file if no rules are active
            try {
                await fs.unlink(masterFilePath);
            } catch {
                // File doesn't exist, which is fine
            }
            return;
        }

        const content = this.generateMasterRulesContent(activeRules);
        
        try {
            await fs.writeFile(masterFilePath, content, 'utf-8');
        } catch (error) {
            console.error('Failed to write master cursor rules file:', error);
            throw error;
        }
    }

    private generateMasterRulesContent(activeRules: CursorRule[]): string {
        const header = `# SolidRules - Combined Cursor Rules
# Generated automatically by SolidRules extension
# Last updated: ${new Date().toISOString()}
# Active rules: ${activeRules.length}

`;

        const rulesContent = activeRules.map(rule => {
            return `
# ============================================
# Rule: ${rule.name}
# Category: ${rule.category}
# Technologies: ${rule.technologies.join(', ')}
# Source: ${rule.isCustom ? 'Custom Rule' : 'GitHub - awesome-cursorrules'}
# ============================================

${rule.content}

`;
        }).join('\n');

        return header + rulesContent;
    }

    private formatRuleContent(rule: CursorRule): string {
        const metadata = `# SolidRules Metadata
# Name: ${rule.name}
# Category: ${rule.category}
# Technologies: ${rule.technologies.join(', ')}
# Tags: ${rule.tags.join(', ')}
# Created: ${rule.createdAt.toISOString()}
# Last Updated: ${rule.lastUpdated?.toISOString() || 'Never'}
# Source: ${rule.isCustom ? 'Custom Rule' : 'GitHub - awesome-cursorrules'}

`;

        return metadata + rule.content;
    }

    private formatProjectRuleContent(rule: CursorRule): string {
        // Determine rule type based on rule properties
        const ruleType = this.determineRuleType(rule);
        
        // YAML frontmatter for MDC format - following Cursor documentation exactly
        let frontmatter = `---
description: ${this.escapeYamlString(rule.description || rule.name)}`;

        // Add globs only if present (for Auto Attached rules)
        if (ruleType.globs) {
            frontmatter += `
globs: ${ruleType.globs}`;
        }

        // Add alwaysApply (for Always rules)
        frontmatter += `
alwaysApply: ${ruleType.alwaysApply}
---

`;

        // Add metadata as comments (more compact format)
        const metadata = `<!-- Generated by SolidRules Extension
Rule: ${rule.name} | Category: ${rule.category}
Technologies: ${rule.technologies.join(', ')} | Tags: ${rule.tags.join(', ')}
Source: ${rule.isCustom ? 'Custom' : 'awesome-cursorrules'}
-->

`;

        return frontmatter + metadata + rule.content;
    }

    private escapeYamlString(str: string): string {
        // Escape YAML special characters
        if (str.includes(':') || str.includes('"') || str.includes("'") || str.includes('\n')) {
            return `"${str.replace(/"/g, '\\"')}"`;
        }
        return str;
    }

    private determineRuleType(rule: CursorRule): { globs?: string; alwaysApply: boolean } {
        // Determine rule type based on Cursor documentation:
        // - Always: alwaysApply: true (always included)
        // - Auto Attached: globs pattern + alwaysApply: false
        // - Agent Requested: description required + alwaysApply: false
        // - Manual: alwaysApply: false (no globs)

        // For technology-specific rules, use Auto Attached with appropriate globs
        if (rule.category === 'Frontend') {
            if (rule.technologies.some(tech => ['react', 'vue', 'angular', 'svelte'].includes(tech))) {
                return { globs: '*.{tsx,jsx,ts,js,vue,svelte}', alwaysApply: false };
            }
            return { globs: '*.{html,css,js,ts}', alwaysApply: false };
        }

        if (rule.category === 'Backend') {
            if (rule.technologies.includes('python')) {
                return { globs: '*.py', alwaysApply: false };
            } else if (rule.technologies.includes('node') || rule.technologies.includes('typescript')) {
                return { globs: '*.{ts,js}', alwaysApply: false };
            } else if (rule.technologies.includes('go')) {
                return { globs: '*.go', alwaysApply: false };
            } else if (rule.technologies.includes('java')) {
                return { globs: '*.java', alwaysApply: false };
            }
            return { globs: '*.{py,js,ts,go,java}', alwaysApply: false };
        }

        if (rule.category === 'Styling') {
            return { globs: '*.{css,scss,sass,less,stylus}', alwaysApply: false };
        }

        if (rule.category === 'Database') {
            return { globs: '*.{sql,prisma,schema}', alwaysApply: false };
        }

        if (rule.category === 'DevOps') {
            return { globs: '*.{yml,yaml,dockerfile,tf,json}', alwaysApply: false };
        }

        // For general rules (Other category), use Agent Requested (no globs)
        // These will be available to AI but not auto-attached
        return { alwaysApply: false };
    }

    private sanitizeFileName(name: string): string {
        return name
            .replace(/[^a-zA-Z0-9\s-_]/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase()
            .substring(0, 50);
    }

    async getRulesDirectoryPath(rulesDirectory: string = 'cursorRules'): Promise<string | null> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            return null;
        }
        return path.join(workspaceId, rulesDirectory);
    }

    async listWorkspaceRuleFiles(rulesDirectory: string = 'cursorRules'): Promise<string[]> {
        const rulesPath = await this.getRulesDirectoryPath(rulesDirectory);
        if (!rulesPath) {
            return [];
        }

        try {
            const files = await fs.readdir(rulesPath);
            return files.filter(file => file.endsWith('.cursorrules'));
        } catch {
            return [];
        }
    }

    async readWorkspaceRuleFile(fileName: string, rulesDirectory: string = 'cursorRules'): Promise<string> {
        const rulesPath = await this.getRulesDirectoryPath(rulesDirectory);
        if (!rulesPath) {
            throw new Error('No workspace is currently open');
        }

        const filePath = path.join(rulesPath, fileName);
        
        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error(`Failed to read rule file ${fileName}:`, error);
            throw error;
        }
    }

    async doesMasterRulesFileExist(): Promise<boolean> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            return false;
        }

        const masterFilePath = path.join(workspaceId, this.CURSOR_RULES_FILE);
        
        try {
            await fs.access(masterFilePath);
            return true;
        } catch {
            return false;
        }
    }

    async backupExistingCursorRules(): Promise<string | null> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            return null;
        }

        const masterFilePath = path.join(workspaceId, this.CURSOR_RULES_FILE);
        const backupFilePath = path.join(workspaceId, `.cursorrules.backup.${Date.now()}`);
        
        try {
            await fs.copyFile(masterFilePath, backupFilePath);
            return backupFilePath;
        } catch {
            return null;
        }
    }

    async getWorkspaceRulesStats(rulesDirectory: string = 'cursorRules'): Promise<{
        totalRuleFiles: number;
        masterFileExists: boolean;
        lastModified?: Date | undefined;
    }> {
        const ruleFiles = await this.listWorkspaceRuleFiles(rulesDirectory);
        const masterExists = await this.doesMasterRulesFileExist();
        
        let lastModified: Date | undefined;
        
        if (masterExists) {
            const workspaceId = this.getCurrentWorkspaceId();
            if (workspaceId) {
                const masterFilePath = path.join(workspaceId, this.CURSOR_RULES_FILE);
                try {
                    const stats = await fs.stat(masterFilePath);
                    lastModified = stats.mtime;
                } catch {
                    // Ignore error
                }
            }
        }

        return {
            totalRuleFiles: ruleFiles.length,
            masterFileExists: masterExists,
            lastModified
        };
    }

    async syncActiveRules(activeRules: CursorRule[], config: WorkspaceRuleConfig): Promise<void> {
        try {
            // Create project rules directory (.cursor/rules)
            await this.createProjectRulesDirectory();

            // Write individual rule files in new MDC format
            for (const rule of activeRules) {
                await this.writeProjectRule(rule);
            }

            // Legacy support: still create old format if requested
            if (config.maintainLegacyFormat) {
                await this.createCursorRulesDirectory(config.rulesDirectory);
                for (const rule of activeRules) {
                    await this.writeRuleToWorkspace(rule, config.rulesDirectory);
                }
                await this.generateMasterCursorRulesFile(activeRules);
            }

        } catch (error) {
            console.error('Failed to sync active rules to workspace:', error);
            throw error;
        }
    }

    async cleanupInactiveRules(allRules: CursorRule[], activeRules: CursorRule[], rulesDirectory: string = 'cursorRules'): Promise<void> {
        const activeRuleIds = new Set(activeRules.map(r => r.id));
        const inactiveRules = allRules.filter(r => !activeRuleIds.has(r.id));

        for (const rule of inactiveRules) {
            await this.removeRuleFromWorkspace(rule, rulesDirectory);
            await this.removeProjectRule(rule); // Also remove from project rules
        }
    }

    async listProjectRuleFiles(): Promise<string[]> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            return [];
        }

        const rulesPath = path.join(workspaceId, this.PROJECT_RULES_DIR);
        
        try {
            const files = await fs.readdir(rulesPath);
            return files.filter(file => file.endsWith('.mdc'));
        } catch {
            return [];
        }
    }

    async getProjectRulesStats(): Promise<{
        totalProjectRules: number;
        projectRulesDirectoryExists: boolean;
        lastModified?: Date | undefined;
    }> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) {
            return { totalProjectRules: 0, projectRulesDirectoryExists: false };
        }

        const rulesPath = path.join(workspaceId, this.PROJECT_RULES_DIR);
        
        try {
            const stats = await fs.stat(rulesPath);
            const files = await this.listProjectRuleFiles();
            
            return {
                totalProjectRules: files.length,
                projectRulesDirectoryExists: true,
                lastModified: stats.mtime
            };
        } catch {
            return { totalProjectRules: 0, projectRulesDirectoryExists: false };
        }
    }

    // Optimized sync with change detection
    async syncActiveRulesOptimized(activeRules: CursorRule[], config: WorkspaceRuleConfig): Promise<void> {
        const startTime = Date.now();
        
        try {
            // 1. Detect changes to avoid unnecessary operations
            const changedRules: CursorRule[] = [];
            const unchangedCount = activeRules.length;
            
            for (const rule of activeRules) {
                const content = this.formatProjectRuleContent(rule);
                const currentHash = this.generateContentHash(content);
                const lastHash = this.lastSyncedRules.get(rule.id);
                
                // Check if file actually exists on disk (critical fix)
                const workspaceId = this.getCurrentWorkspaceId();
                let fileExists = false;
                if (workspaceId) {
                    const fileName = `${this.sanitizeFileName(rule.name)}.mdc`;
                    const filePath = path.join(workspaceId, this.PROJECT_RULES_DIR, fileName);
                    try {
                        await fs.access(filePath);
                        fileExists = true;
                    } catch {
                        fileExists = false;
                    }
                }
                
                // Rule needs sync if: hash changed OR file doesn't exist
                if (lastHash !== currentHash || !fileExists) {
                    changedRules.push(rule);
                    this.lastSyncedRules.set(rule.id, currentHash);
                }
            }

            // 2. Cleanup cache to prevent memory bloat
            if (this.lastSyncedRules.size > this.SYNC_CACHE_SIZE) {
                const entries = Array.from(this.lastSyncedRules.entries());
                const toKeep = entries.slice(-this.SYNC_CACHE_SIZE);
                this.lastSyncedRules.clear();
                toKeep.forEach(([id, hash]) => this.lastSyncedRules.set(id, hash));
            }

            // 3. Only process changed rules
            if (changedRules.length === 0) {
                console.log(`⚡ Sync skipped - no changes detected (${unchangedCount} rules)`);
                return;
            }

            // 4. Parallel directory creation (only if needed)
            await this.createProjectRulesDirectory();

            // 5. Parallel file operations for changed rules only
            const writePromises = changedRules.map(rule => this.writeProjectRuleOptimized(rule));
            await Promise.all(writePromises);

            // 6. Legacy support (only if needed and requested)
            if (config.maintainLegacyFormat) {
                await Promise.all([
                    this.createCursorRulesDirectory(config.rulesDirectory),
                    this.generateMasterCursorRulesFileOptimized(activeRules)
                ]);
            }

            const duration = Date.now() - startTime;
            console.log(`🚀 Optimized sync completed in ${duration}ms - ${changedRules.length}/${unchangedCount} rules updated`);
            
        } catch (error) {
            console.error('❌ Failed to sync active rules optimized:', error);
            throw error;
        }
    }

    // Optimized write with error handling and atomic operations
    private async writeProjectRuleOptimized(rule: CursorRule): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) return;

        try {
            const rulesPath = path.join(workspaceId, this.PROJECT_RULES_DIR);
            const fileName = `${this.sanitizeFileName(rule.name)}.mdc`;
            const filePath = path.join(rulesPath, fileName);
            const content = this.formatProjectRuleContent(rule);

            // Atomic write operation
            const tempPath = `${filePath}.tmp`;
            await fs.writeFile(tempPath, content, 'utf-8');
            await fs.rename(tempPath, filePath);
            
        } catch (error) {
            console.error(`Failed to write optimized project rule ${rule.name}:`, error);
            throw error;
        }
    }

    // Optimized master file generation with smart content management
    private async generateMasterCursorRulesFileOptimized(activeRules: CursorRule[]): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) return;

        try {
            const masterFilePath = path.join(workspaceId, this.CURSOR_RULES_FILE);
            const content = this.generateMasterRulesContent(activeRules);
            
            // Check if content has changed AND file exists
            const contentHash = this.generateContentHash(content);
            const lastMasterHash = this.lastSyncedRules.get('__MASTER__');
            
            // Check if master file actually exists on disk
            let masterFileExists = false;
            try {
                await fs.access(masterFilePath);
                masterFileExists = true;
            } catch {
                masterFileExists = false;
            }
            
            // Skip only if hash is same AND file exists
            if (lastMasterHash === contentHash && masterFileExists) {
                console.log('⚡ Master file unchanged - skipping write');
                return;
            }

            // Atomic write for master file
            const tempPath = `${masterFilePath}.tmp`;
            await fs.writeFile(tempPath, content, 'utf-8');
            await fs.rename(tempPath, masterFilePath);
            
            this.lastSyncedRules.set('__MASTER__', contentHash);
            console.log('📝 Master .cursorrules file updated');
            
        } catch (error) {
            console.error('Failed to generate optimized master cursor rules file:', error);
            throw error;
        }
    }

    // Parallel bulk cleanup for better performance
    async bulkCleanupRules(ruleIds: string[], rulesDirectory: string = 'cursorRules'): Promise<void> {
        const startTime = Date.now();
        
        try {
            const rules = await Promise.all(
                ruleIds.map(async (id) => {
                    // Use a more efficient method to get rule metadata
                    return { id, name: `rule-${id}` }; // Simplified for cleanup
                })
            );

            // Parallel cleanup operations
            const cleanupPromises = rules.map(async (rule) => {
                try {
                    await Promise.all([
                        this.removeProjectRuleOptimized(rule.id),
                        this.removeRuleFromWorkspaceOptimized(rule.name, rulesDirectory)
                    ]);
                } catch (error) {
                    console.error(`Failed to cleanup rule ${rule.id}:`, error);
                    // Continue with other rules
                }
            });

            await Promise.all(cleanupPromises);
            
            const duration = Date.now() - startTime;
            console.log(`🧹 Bulk cleanup completed in ${duration}ms - ${rules.length} rules`);
            
        } catch (error) {
            console.error('Failed to bulk cleanup rules:', error);
            throw error;
        }
    }

    // Optimized removal methods
    private async removeProjectRuleOptimized(ruleId: string): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) return;

        try {
            const rulesPath = path.join(workspaceId, this.PROJECT_RULES_DIR);
            const files = await fs.readdir(rulesPath).catch(() => []);
            
            // Find and remove the rule file
            const ruleFile = files.find(file => file.includes(ruleId) && file.endsWith('.mdc'));
            if (ruleFile) {
                await fs.unlink(path.join(rulesPath, ruleFile));
            }
            
            // Remove from cache
            this.lastSyncedRules.delete(ruleId);
            
        } catch (error) {
            console.error(`Failed to remove optimized project rule ${ruleId}:`, error);
        }
    }

    private async removeRuleFromWorkspaceOptimized(ruleName: string, rulesDirectory: string): Promise<void> {
        const workspaceId = this.getCurrentWorkspaceId();
        if (!workspaceId) return;

        try {
            const rulesPath = path.join(workspaceId, rulesDirectory);
            const fileName = `${this.sanitizeFileName(ruleName)}.cursorrules`;
            const filePath = path.join(rulesPath, fileName);
            
            await fs.unlink(filePath).catch(() => {
                // File might not exist, ignore error
            });
            
        } catch (error) {
            console.error(`Failed to remove optimized workspace rule ${ruleName}:`, error);
        }
    }

    // Method to clear sync cache (useful for debugging or reset)
    clearSyncCache(): void {
        console.log(`🗑️ Clearing sync cache - ${this.lastSyncedRules.size} entries removed`);
        this.lastSyncedRules.clear();
    }

    // Debug method to inspect sync cache state
    getSyncCacheStats(): { size: number; entries: string[] } {
        const entries = Array.from(this.lastSyncedRules.keys());
        return {
            size: this.lastSyncedRules.size,
            entries: entries
        };
    }
} 