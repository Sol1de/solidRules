import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CursorRule, WorkspaceRuleConfig } from '../types';

export class WorkspaceManager {
    private readonly CURSOR_RULES_FILE = '.cursorrules';

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

    async generateMasterCursorRulesFile(activeRules: CursorRule[], rulesDirectory: string = 'cursorRules'): Promise<void> {
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
            // Create rules directory if it doesn't exist
            await this.createCursorRulesDirectory(config.rulesDirectory);

            // Write individual rule files
            for (const rule of activeRules) {
                await this.writeRuleToWorkspace(rule, config.rulesDirectory);
            }

            // Generate master .cursorrules file
            await this.generateMasterCursorRulesFile(activeRules, config.rulesDirectory);

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
        }
    }
} 