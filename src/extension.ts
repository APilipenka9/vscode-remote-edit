// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TextDecoder } from "util";
const sshClient: any = require("node-sshclient");

// Constants
const REMOTE_SEPARATOR = "/";

// Messages
const ASK_FOR_HOST = "Enter host name: ";
const ASK_FOR_USER = "Enter user name: ";

export function activate(context: vscode.ExtensionContext) {

		console.log('Congratulations, your extension "remote-edit" is now active!');


	let disposable = vscode.commands.registerCommand('extension.downloadRemote', async () => {
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
			pathIsAbsolute ? remotePath : 
				`${rootDir}${REMOTE_SEPARATOR}${remotePath}`;
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

		const localFilePath = textEditor.document.fileName;
		//const fileName = splitPath(localFilePath, path.sep).filename;

		let remotePath: string;
		if (configuration.has("rootDir")) {
			remotePath = configuration.get("rootDir") as string;
			let relativePath = vscode.workspace.asRelativePath(localFilePath);
			relativePath = relativePath.replace(path.sep, REMOTE_SEPARATOR);
			//relativePath = splitRemotePath(relativePath).dirname;
			remotePath = `${remotePath}${REMOTE_SEPARATOR}${relativePath}`;
		}
		else {
			let input = await vscode.window.showInputBox({
				prompt: "Enter remote directory: "
			}) as string;
			if (!input) {
				return;
			}
			remotePath = input as string;
		}
		notify(`remotePath = ${remotePath}`);
		
		try {
			await upload(host, user, localFilePath, remotePath);
			vscode.window.showInformationMessage(
				`Uploaded to ${remotePath}`);
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
	return path.startsWith(REMOTE_SEPARATOR);
}

interface Path {
	dirname: string,
	filename: string
}

function splitRemotePath(pathStr: string) {
	return splitPath(pathStr, REMOTE_SEPARATOR);
}

function splitPath(pathStr: string, separator: string): Path {
	const lastPathSepIndex = pathStr.lastIndexOf(separator);
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