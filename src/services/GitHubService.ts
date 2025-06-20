import { Octokit } from '@octokit/rest';
import * as vscode from 'vscode';
import { GitHubRuleInfo, CursorRule } from '../types';

export class GitHubService {
    private octokit!: Octokit;
    private readonly REPO_OWNER = 'PatrickJS';
    private readonly REPO_NAME = 'awesome-cursorrules';
    private readonly RULES_PATH = 'rules';

    constructor() {
        this.initializeOctokit();
    }

    private initializeOctokit(): void {
        const config = vscode.workspace.getConfiguration('solidrules');
        const githubToken = config.get<string>('githubToken', '');
        
        if (githubToken) {
            console.log('✅ Using GitHub token for API requests (5000 req/h)');
            console.log(`Token starts with: ${githubToken.substring(0, 10)}...`);
            this.octokit = new Octokit({
                auth: githubToken
            });
        } else {
            console.log('⚠️ Using GitHub API without token (60 req/h limit)');
            this.octokit = new Octokit();
        }
    }

    // Method to refresh token if settings change
    public refreshToken(): void {
        console.log('🔄 Refreshing GitHub token...');
        this.initializeOctokit();
    }

    async fetchRulesList(): Promise<GitHubRuleInfo[]> {
        try {
            const response = await this.octokit.repos.getContent({
                owner: this.REPO_OWNER,
                repo: this.REPO_NAME,
                path: this.RULES_PATH
            });

            if (Array.isArray(response.data)) {
                return response.data
                    .filter(item => item.type === 'dir')
                    .map(item => ({
                        path: item.path,
                        name: item.name,
                        sha: item.sha,
                        size: item.size || 0,
                        download_url: item.download_url || '',
                        type: item.type as 'file' | 'dir'
                    }));
            }
            return [];
        } catch (error: any) {
            console.error('Error fetching rules list:', error);
            
            // Handle rate limit specifically
            if (error.status === 403 && error.message?.includes('rate limit')) {
                throw new Error('GitHub API rate limit exceeded. Please wait a few minutes before trying again. Consider using a GitHub token for higher rate limits.');
            }
            
            throw new Error(`Failed to fetch rules from GitHub: ${error.message || error}`);
        }
    }

    async fetchRuleContent(rulePath: string): Promise<string> {
        try {
            // Look for .cursorrules file in the rule directory
            const response = await this.octokit.repos.getContent({
                owner: this.REPO_OWNER,
                repo: this.REPO_NAME,
                path: `${rulePath}/.cursorrules`
            });

            if (!Array.isArray(response.data) && response.data.type === 'file') {
                const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
                return content;
            }
            throw new Error('Rule content not found');
        } catch (error) {
            console.error(`Error fetching rule content for ${rulePath}:`, error);
            throw new Error(`Failed to fetch rule content: ${error}`);
        }
    }

    async fetchRuleMetadata(rulePath: string): Promise<{ description: string; technologies: string[] }> {
        try {
            // Try to fetch README.md from the rule directory
            let description = '';
            try {
                const readmeResponse = await this.octokit.repos.getContent({
                    owner: this.REPO_OWNER,
                    repo: this.REPO_NAME,
                    path: `${rulePath}/README.md`
                });

                if (!Array.isArray(readmeResponse.data) && readmeResponse.data.type === 'file') {
                    description = Buffer.from(readmeResponse.data.content, 'base64').toString('utf-8');
                    // Extract first paragraph as description
                    const firstParagraph = description.split('\n').find(line => line.trim() && !line.startsWith('#'));
                    description = firstParagraph || '';
                }
            } catch {
                // README not found, use rule name as description
                description = this.parseRuleName(rulePath).join(', ');
            }

            const technologies = this.parseTechnologiesFromPath(rulePath);
            
            return { description, technologies };
        } catch (error) {
            console.error(`Error fetching metadata for ${rulePath}:`, error);
            return { 
                description: this.parseRuleName(rulePath).join(', '), 
                technologies: this.parseTechnologiesFromPath(rulePath) 
            };
        }
    }

    async createCursorRuleFromGitHub(ruleInfo: GitHubRuleInfo): Promise<CursorRule> {
        try {
            const content = await this.fetchRuleContent(ruleInfo.path);
            const { description, technologies } = await this.fetchRuleMetadata(ruleInfo.path);
            
            const ruleId = this.generateRuleId(ruleInfo.path);
            const category = this.getCategoryFromTechnologies(technologies);
            const tags = this.generateTagsFromPath(ruleInfo.path);

            return {
                id: ruleId,
                name: this.formatRuleName(ruleInfo.name),
                description,
                content,
                technologies,
                tags,
                category,
                isActive: false,
                isFavorite: false,
                isCustom: false,
                githubPath: ruleInfo.path,
                createdAt: new Date(),
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error(`Error creating rule from GitHub data:`, error);
            throw error;
        }
    }

    private generateRuleId(path: string): string {
        return path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    }

    private formatRuleName(name: string): string {
        return name
            .replace(/-/g, ' ')
            .replace(/cursorrules|prompt|file/gi, '')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private parseRuleName(path: string): string[] {
        const name = path.split('/').pop() || '';
        return name.split('-').filter(part => 
            !['cursorrules', 'prompt', 'file'].includes(part.toLowerCase())
        );
    }

    private parseTechnologiesFromPath(path: string): string[] {
        const name = path.split('/').pop() || '';
        const parts = name.split('-');
        
        const knownTechnologies = [
            'react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'typescript', 'javascript',
            'node', 'express', 'fastapi', 'django', 'flask', 'spring', 'laravel',
            'go', 'rust', 'python', 'java', 'php', 'csharp', 'cpp',
            'tailwind', 'css', 'sass', 'styled', 'material',
            'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis',
            'docker', 'kubernetes', 'aws', 'azure', 'gcp',
            'jest', 'cypress', 'playwright', 'testing'
        ];

        return parts.filter(part => 
            knownTechnologies.some(tech => 
                part.toLowerCase().includes(tech) || tech.includes(part.toLowerCase())
            )
        ).map(tech => tech.toLowerCase());
    }

    private getCategoryFromTechnologies(technologies: string[]): string {
        const categoryMap: Record<string, string[]> = {
            'Frontend': ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'typescript', 'javascript'],
            'Backend': ['node', 'express', 'fastapi', 'django', 'flask', 'spring', 'laravel', 'go', 'rust'],
            'Mobile': ['react-native', 'flutter', 'ionic', 'xamarin'],
            'Styling': ['tailwind', 'css', 'sass', 'styled', 'material'],
            'Database': ['mongodb', 'postgresql', 'mysql', 'sqlite', 'redis'],
            'DevOps': ['docker', 'kubernetes', 'aws', 'azure', 'gcp'],
            'Testing': ['jest', 'cypress', 'playwright', 'testing']
        };

        for (const [category, techs] of Object.entries(categoryMap)) {
            if (technologies.some(tech => techs.includes(tech))) {
                return category;
            }
        }

        return 'Other';
    }

    private generateTagsFromPath(path: string): string[] {
        const name = path.split('/').pop() || '';
        const parts = name.split('-');
        
        return parts
            .filter(part => !['cursorrules', 'prompt', 'file'].includes(part.toLowerCase()))
            .map(part => part.toLowerCase());
    }

    async checkForUpdates(currentRules: CursorRule[]): Promise<Map<string, boolean>> {
        const updateMap = new Map<string, boolean>();
        
        try {
            const latestRules = await this.fetchRulesList();
            const latestRulesMap = new Map(
                latestRules.map(rule => [this.generateRuleId(rule.path), rule.sha])
            );

            for (const rule of currentRules) {
                if (rule.githubPath && !rule.isCustom) {
                    const ruleId = this.generateRuleId(rule.githubPath);
                    const latestSha = latestRulesMap.get(ruleId);
                    
                    if (latestSha && rule.version !== latestSha) {
                        updateMap.set(rule.id, true);
                    } else {
                        updateMap.set(rule.id, false);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }

        return updateMap;
    }
} 