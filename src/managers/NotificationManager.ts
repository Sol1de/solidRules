import * as vscode from 'vscode';
import { NotificationOptions, UpdateInfo } from '../types';

export class NotificationManager {
    
    async showUpdateNotification(updates: UpdateInfo[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('solidrules');
        const enableNotifications = config.get<boolean>('enableNotifications', true);
        
        if (!enableNotifications) {
            return;
        }

        if (updates.length === 0) {
            return;
        }

        if (updates.length === 1) {
            const update = updates[0];
            const action = await vscode.window.showInformationMessage(
                `Rule "${update.ruleName}" has an update available`,
                'Update Now',
                'Later'
            );
            
            if (action === 'Update Now') {
                await vscode.commands.executeCommand('solidrules.updateRule', update.ruleId);
            }
        } else {
            const rulesList = updates.map(u => `• ${u.ruleName}`).join('\n');
            const action = await vscode.window.showInformationMessage(
                `${updates.length} rules have updates available:\n${rulesList}`,
                'Update All',
                'Later'
            );
            
            if (action === 'Update All') {
                await vscode.commands.executeCommand('solidrules.updateAllRules');
            }
        }
    }

    async showNotification(options: NotificationOptions): Promise<void> {
        const { message, actions, isModal } = options;
        
        if (isModal) {
            if (actions && actions.length > 0) {
                const actionTitles = actions.map(a => a.title);
                const selectedAction = await vscode.window.showInformationMessage(
                    message,
                    { modal: true },
                    ...actionTitles
                );
                
                const action = actions.find(a => a.title === selectedAction);
                if (action) {
                    await action.action();
                }
            } else {
                await vscode.window.showInformationMessage(message, { modal: true });
            }
        } else {
            if (actions && actions.length > 0) {
                const actionTitles = actions.map(a => a.title);
                const selectedAction = await vscode.window.showInformationMessage(
                    message,
                    ...actionTitles
                );
                
                const action = actions.find(a => a.title === selectedAction);
                if (action) {
                    await action.action();
                }
            } else {
                vscode.window.showInformationMessage(message);
            }
        }
    }

    async showErrorMessage(message: string, ...actions: string[]): Promise<string | undefined> {
        return await vscode.window.showErrorMessage(message, ...actions);
    }

    async showWarningMessage(message: string, ...actions: string[]): Promise<string | undefined> {
        return await vscode.window.showWarningMessage(message, ...actions);
    }

    async showSuccessMessage(message: string): Promise<void> {
        vscode.window.showInformationMessage(message);
    }

    async showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined> {
        return await vscode.window.showInformationMessage(message, ...actions);
    }

    async showRuleActivatedNotification(ruleName: string): Promise<void> {
        this.showSuccessMessage(`Rule "${ruleName}" has been activated`);
    }

    async showRuleDeactivatedNotification(ruleName: string): Promise<void> {
        this.showSuccessMessage(`Rule "${ruleName}" has been deactivated`);
    }

    async showRuleAddedToFavoritesNotification(ruleName: string): Promise<void> {
        this.showSuccessMessage(`Rule "${ruleName}" added to favorites`);
    }

    async showRuleRemovedFromFavoritesNotification(ruleName: string): Promise<void> {
        this.showSuccessMessage(`Rule "${ruleName}" removed from favorites`);
    }

    async showCustomRuleImportedNotification(ruleName: string): Promise<void> {
        this.showSuccessMessage(`Custom rule "${ruleName}" imported successfully`);
    }

    async showRulesRefreshedNotification(count: number): Promise<void> {
        this.showSuccessMessage(`${count} rules refreshed from GitHub`);
    }

    async confirmRuleOverwrite(ruleName: string): Promise<boolean> {
        const action = await vscode.window.showWarningMessage(
            `Rule "${ruleName}" already exists. Do you want to overwrite it?`,
            { modal: true },
            'Overwrite',
            'Cancel'
        );
        
        return action === 'Overwrite';
    }

    async confirmDeleteRule(ruleName: string): Promise<boolean> {
        const action = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the rule "${ruleName}"?`,
            { modal: true },
            'Delete',
            'Cancel'
        );
        
        return action === 'Delete';
    }

    async showProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
    ): Promise<T> {
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: title,
                cancellable: false
            },
            task
        );
    }

    async showProgressWithCancellation<T>(
        title: string,
        task: (
            progress: vscode.Progress<{ message?: string; increment?: number }>,
            token: vscode.CancellationToken
        ) => Promise<T>
    ): Promise<T> {
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: title,
                cancellable: true
            },
            task
        );
    }
} 