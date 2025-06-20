import * as vscode from 'vscode';

export class ActiveRuleDecorator implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (uri.scheme === 'rule-active') {
            return {
                badge: '✓',
                color: new vscode.ThemeColor('solidrules.activeRule.foreground'),
                tooltip: 'Active Rule - Click to deactivate',
                propagate: false
            };
        }
        return undefined;
    }

    refresh(): void {
        this._onDidChangeFileDecorations.fire(undefined);
    }

    dispose(): void {
        this._onDidChangeFileDecorations.dispose();
    }
} 