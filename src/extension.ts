// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
const sshClient: any = require("node-sshclient");

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
		let host;
		let user;
		let rootDir;

		const configuration = vscode.workspace.getConfiguration("remote");
		if (!configuration.has("host")) {
			host = await vscode.window.showInputBox({
				prompt: "Enter a host name"
			}) as string;
		}
		else {
			host = configuration.get("host") as string;
		}
		if (!configuration.has("user")) {
			user = await vscode.window.showInputBox({
				prompt: "Enter user name"
			}) as string;
		}
		else {
			user = configuration.get("user") as string;
		}
		rootDir = configuration.get("rootDir", "~");

		const input = await vscode.window.showInputBox({
				prompt: "Enter a path to remote file"
		});
		if (!input) {
			return;
		}
		const remotePath = input as string;
		const pathIsAbsolute = isAbsolute(remotePath);
		console.log(`Remote path is ${remotePath}`);

		let remoteFilePath = 
			pathIsAbsolute ? remotePath : `${rootDir}/${remotePath}`;
		console.log(`Host is ${host}`);
		console.log(`User is ${user}`);
		console.log(`Remote root directory is ${rootDir}`);

		const workspaceDir = vscode.workspace.rootPath as string;

		const relativeRemoteDir = splitRemotePath(remotePath).dirname;
		const filename = splitRemotePath(remotePath).filename;
		let localDir;
		if (pathIsAbsolute) {
			const chosen = await vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false
			});
			if (!chosen) {
				return;
			}
			else {
				localDir = (chosen as vscode.Uri[])[0].fsPath;
				notify(`localDir = ${localDir}`);
			}
		}
		else {
			localDir = path.join(workspaceDir, relativeRemoteDir);
			mkdirIfNotExist(localDir);
		}

		try {
			await getFromRemote(host, user, localDir, remoteFilePath);
		} catch (error) {
			vscode.window.showErrorMessage(error);
			return;
		}

		const localPath = path.join(localDir, filename);
		await vscode.workspace.openTextDocument(localPath);
		notify("Opened");
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function getFromRemote(host: string, user: string,	localDir: string,
		remoteFile: string) {
	await download(host, user, localDir, remoteFile);

}

function notify(message: string) {
	console.log(message);
	//vscode.window.showInformationMessage(message);
}

function mkdirIfNotExist(dirname: string) {
	if (!fs.existsSync(dirname)) {
		fs.mkdirSync(dirname, {recursive: true});
	}
}

function download(host: string, user: string, localDir: string,
	remoteFile: string) {
		const scp = new sshClient.SCP({hostname: host, user: user});
		return new Promise((resolve, reject) => {
			scp.download(remoteFile, localDir, (result: any) => {
				notify("result = " + result);
				if (result.exitCode === 0) {
					resolve(result.stdout);
				}
				else {
					reject(result.stderr);
				}
			});
		});
}

function isAbsolute(path: string) {
	return path.startsWith("/");
}

interface Path {
	dirname: string,
	filename: string
}

function splitRemotePath(pathStr: string): Path {
	const lastPathSepIndex = pathStr.lastIndexOf("/");
	const dirname = pathStr.slice(0, lastPathSepIndex);
	notify(`dirname = ${dirname}`);
	const filename = pathStr.substr(lastPathSepIndex + 1);
	notify(`filename = ${filename}`);
	return {
		dirname: dirname,
		filename: filename
	}
}