// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
const client: any = require("scp2");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
		console.log('Congratulations, your extension "remote-edit" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.openRemote', async () => {
		/*const remotePath = await vscode.window.showInputBox({prompt: "Enter a path to remote file"});
		console.log(`Remote path is ${remotePath}`);

		const configuration = vscode.workspace.getConfiguration("remote");
		const host = configuration.get("host");
		const user = configuration.get("user");
		const rootDir = configuration.get("rootDir");
		console.log(`Host is ${host}`);
		console.log(`User is ${user}`);
		console.log(`Remote root directory is ${rootDir}`);
		console.log(configuration);*/

		const localPath = vscode.env.appRoot;
		const remotePath = "/u/ts6227/test/BRMSTSKA";
		const host = "dvlp";
		const user = "ts6227";

		client.scp(localPath, {host: host, username: user, path: remotePath}, (err: any) => {
				console.log(err);
				vscode.window.showInformationMessage(err);
		});

		vscode.workspace.openTextDocument(localPath);
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
