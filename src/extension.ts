// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TextDecoder } from "util";
const sshClient: any = require("node-sshclient");

// Messages
const ASK_FOR_HOST = "Enter host name: ";
const ASK_FOR_USER = "Enter user name: ";

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
		let host: string;
		let user: string;
		let rootDir: string;

		const configuration = vscode.workspace.getConfiguration("remote");
		host = await getConfigParamOfAskFor(configuration, "host", ASK_FOR_HOST);
		user = await getConfigParamOfAskFor(configuration, "user", ASK_FOR_USER);

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
		const document = await vscode.workspace.openTextDocument(localPath);
		await vscode.window.showTextDocument(document, {preview: false});
		notify("Opened");
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand("extension.uploadToRemote", async () => {
		const configuration = vscode.workspace.getConfiguration("remote");
		let host = await getConfigParamOfAskFor(configuration, "host", ASK_FOR_HOST);
		let user = await getConfigParamOfAskFor(configuration, "user", ASK_FOR_USER);

		let textEditor: vscode.TextEditor;
		if (vscode.window.activeTextEditor) {
			textEditor = vscode.window.activeTextEditor;
		}
		else {
			vscode.window.showInformationMessage("No active document");
			return;
		}

		const localFileName = textEditor.document.fileName;

		let remoteDir: string;
		if (configuration.has("rootDir")) {
			remoteDir = configuration.get("rootDir") as string;
			let relativePath = vscode.workspace.asRelativePath(localFileName);
			relativePath = relativePath.replace("\\", "/");
			remoteDir = `${remoteDir}/${relativePath}`;
		}
		else {
			let input = await vscode.window.showInputBox({
				prompt: "Enter remote directory: "
			}) as string;
			if (!input) {
				return;
			}
			remoteDir = input as string;
		}
		notify(`remoteDir = ${remoteDir}`);
		
		try {
			await upload(host, user, localFileName, remoteDir);
			vscode.window.showInformationMessage(
				`Uploaded to ${remoteDir}/${localFileName}`);
		} catch(error) {
			vscode.window.showErrorMessage(error);
		}
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

function upload(host: string, user: string, localFile: string, remoteDir: string) { 
	const scp = new sshClient.SCP({hostname: host, user: user});
	return new Promise((resolve, reject) => {
		scp.upload(localFile, remoteDir, (result: any) => {
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
	if (lastPathSepIndex >= 0) {
		const dirname = pathStr.slice(0, lastPathSepIndex);
		const filename = pathStr.substr(lastPathSepIndex + 1);
		return {
			dirname: dirname,
			filename: filename
		}
	}
	else {
		return {
			dirname: "",
			filename: pathStr
		}
	}
}

async function getConfigParamOfAskFor(configuration: vscode.WorkspaceConfiguration,
		paramName: string, askMessage: string) {
	if (!configuration.has(paramName)) {
		return await vscode.window.showInputBox({
			prompt: askMessage
		}) as string;
	}
	else {
		return configuration.get(paramName) as string;
	}
}