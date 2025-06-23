import { Octokit } from '@octokit/rest';
import * as vscode from 'vscode';
import { GitHubRuleInfo, CursorRule } from '../types';

export class GitHubService {
    private octokit!: Octokit;
    private readonly REPO_OWNER = 'PatrickJS';
    private readonly REPO_NAME = 'awesome-cursorrules';
    private readonly RULES_PATHS = [
        { path: 'rules', format: 'directory' },      // Old format: directories with .cursorrules
        { path: 'rules-new', format: 'file' }       // New format: direct .mdc files
    ];

    // Secure token storage using VSCode SecretStorage API
    private readonly TOKEN_SECRET_KEY = 'solidrules.github.token';

    constructor(private context: vscode.ExtensionContext) {
        this.initializeOctokit();
    }

    private async initializeOctokit(): Promise<void> {
        try {
            const githubToken = await this.getSecureToken();
            
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
        } catch (error) {
            console.error('❌ Failed to initialize GitHub service:', error);
            // Fallback to non-authenticated client
            this.octokit = new Octokit();
        }
    }

    // Secure token management
    async getSecureToken(): Promise<string | undefined> {
        try {
            return await this.context.secrets.get(this.TOKEN_SECRET_KEY);
        } catch (error) {
            console.error('❌ Failed to retrieve secure token:', error);
            return undefined;
        }
    }

    async setSecureToken(token: string): Promise<void> {
        try {
            await this.context.secrets.store(this.TOKEN_SECRET_KEY, token);
            console.log('✅ GitHub token stored securely');
            await this.initializeOctokit(); // Reinitialize with new token
        } catch (error) {
            console.error('❌ Failed to store secure token:', error);
            throw new Error(`Failed to store GitHub token: ${error}`);
        }
    }

    async deleteSecureToken(): Promise<void> {
        try {
            await this.context.secrets.delete(this.TOKEN_SECRET_KEY);
            console.log('✅ GitHub token deleted securely');
            await this.initializeOctokit(); // Reinitialize without token
        } catch (error) {
            console.error('❌ Failed to delete secure token:', error);
            throw new Error(`Failed to delete GitHub token: ${error}`);
        }
    }

    // Method to refresh token if needed
    public async refreshToken(): Promise<void> {
        try {
            console.log('🔄 Refreshing GitHub token...');
            await this.initializeOctokit();
        } catch (error) {
            console.error('❌ Failed to refresh GitHub token:', error);
            throw error;
        }
    }

    async fetchRulesList(): Promise<GitHubRuleInfo[]> {
        try {
            console.log(`📡 Fetching rules list from ${this.REPO_OWNER}/${this.REPO_NAME}...`);
            
            const allRules: GitHubRuleInfo[] = [];
            
            // Parse both rules directories with different formats
            for (const rulesConfig of this.RULES_PATHS) {
                try {
                    console.log(`📁 Processing directory: ${rulesConfig.path} (format: ${rulesConfig.format})`);
                    
                    const response = await this.octokit.repos.getContent({
                        owner: this.REPO_OWNER,
                        repo: this.REPO_NAME,
                        path: rulesConfig.path
                    });

                    if (Array.isArray(response.data)) {
                        const allItems = response.data;
                        let rules: GitHubRuleInfo[] = [];
                        
                        if (rulesConfig.format === 'directory') {
                            // Old format: filter directories
                            const directories = allItems.filter(item => item.type === 'dir');
                            console.log(`📊 Directory ${rulesConfig.path}: ${allItems.length} total items, ${directories.length} rule directories`);
                            
                            rules = directories.map(item => ({
                                path: item.path,
                                name: item.name,
                                sha: item.sha,
                                size: item.size || 0,
                                download_url: item.download_url || '',
                                type: item.type as 'file' | 'dir',
                                format: 'directory'
                            }));
                        } else if (rulesConfig.format === 'file') {
                            // New format: filter .mdc files
                            const mdcFiles = allItems.filter(item => 
                                item.type === 'file' && item.name.endsWith('.mdc')
                            );
                            console.log(`📊 Directory ${rulesConfig.path}: ${allItems.length} total items, ${mdcFiles.length} .mdc rule files`);
                            
                            rules = mdcFiles.map(item => ({
                                path: item.path,
                                name: item.name.replace('.mdc', ''), // Remove .mdc extension for display
                                sha: item.sha,
                                size: item.size || 0,
                                download_url: item.download_url || '',
                                type: item.type as 'file' | 'dir',
                                format: 'file'
                            }));
                        }
                        
                        allRules.push(...rules);
                        console.log(`✅ Successfully parsed ${rules.length} rules from ${rulesConfig.path}`);
                    } else {
                        console.warn(`⚠️ Directory ${rulesConfig.path}: GitHub API response is not an array`);
                    }
                } catch (error: any) {
                    // Enhanced error handling with specific error types
                    if (error.status === 404) {
                        console.warn(`⚠️ Directory ${rulesConfig.path} not found in repository`);
                    } else if (error.status === 403 && error.message?.includes('rate limit')) {
                        console.error(`❌ GitHub API rate limit exceeded for directory ${rulesConfig.path}`);
                        throw new Error('GitHub API rate limit exceeded. Please wait a few minutes before trying again.');
                    } else {
                        console.error(`❌ Error processing directory ${rulesConfig.path}:`, error);
                        throw new Error(`Failed to process rules directory: ${error.message || error}`);
                    }
                }
            }
            
            // Remove duplicates based on rule name (in case same rule exists in both directories)
            const uniqueRules = allRules.filter((rule, index, self) => 
                index === self.findIndex(r => r.name === rule.name)
            );
            
            if (uniqueRules.length !== allRules.length) {
                console.log(`🔄 Removed ${allRules.length - uniqueRules.length} duplicate rules`);
            }
            
            console.log(`✅ Total rules found: ${uniqueRules.length} (from ${this.RULES_PATHS.map(p => p.path).join(', ')})`);
            
            // Log some examples for debugging
            if (uniqueRules.length > 0) {
                console.log(`📁 Sample rules: ${uniqueRules.slice(0, 5).map(d => d.name).join(', ')}...`);
            }
            
            return uniqueRules;
            
        } catch (error: any) {
            console.error('❌ Error fetching rules list:', error);
            
            // Enhanced error handling with standardized patterns
            if (error.status === 403 && error.message?.includes('rate limit')) {
                throw new Error('GitHub API rate limit exceeded. Please wait a few minutes before trying again. Consider using a GitHub token for higher rate limits.');
            } else if (error.status === 401) {
                throw new Error('GitHub authentication failed. Please check your token and try again.');
            } else if (error.status === 404) {
                throw new Error('GitHub repository not found. Please check the repository configuration.');
            }
            
            throw new Error(`Failed to fetch rules from GitHub: ${error.message || error}`);
        }
    }

    async fetchRuleContent(rulePath: string, format?: string): Promise<string> {
        try {
            let contentPath: string;
            
            // Determine content path based on format
            if (format === 'file') {
                // New format: direct .mdc file - path already includes .mdc extension
                contentPath = rulePath;
            } else {
                // Old format: .cursorrules file in directory
                contentPath = `${rulePath}/.cursorrules`;
            }
            
            console.log(`📄 Fetching content from: ${contentPath} (format: ${format})`);
            
            const response = await this.octokit.repos.getContent({
                owner: this.REPO_OWNER,
                repo: this.REPO_NAME,
                path: contentPath
            });

            if (!Array.isArray(response.data) && response.data.type === 'file') {
                const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
                console.log(`✅ Successfully fetched content for ${contentPath} (${content.length} chars)`);
                return content;
            }
            throw new Error('Rule content not found');
        } catch (error: any) {
            console.error(`❌ Error fetching rule content for ${rulePath}:`, error);
            
            // Enhanced error handling
            if (error.status === 404) {
                throw new Error(`Rule content not found: ${rulePath}`);
            } else if (error.status === 403 && error.message?.includes('rate limit')) {
                throw new Error('GitHub API rate limit exceeded while fetching rule content.');
            }
            
            throw new Error(`Failed to fetch rule content: ${error.message || error}`);
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
            // Fetch content and metadata in parallel for better performance
            const [content, { description, technologies }] = await Promise.all([
                this.fetchRuleContent(ruleInfo.path, ruleInfo.format),
                this.fetchRuleMetadata(ruleInfo.path)
            ]);
            
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