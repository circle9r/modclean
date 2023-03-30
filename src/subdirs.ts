import path from 'path';
import fs from 'fs-extra';

const subdirs = async (root: string, maxDepth: number = Infinity): Promise<string[]> => {
	const subs: string[] = [];

	const enqueue = async (filePath: string, depth: number): Promise<void> => {
		if (depth > maxDepth) {
			return;
		}

		const stat: fs.Stats = fs.lstatSync(filePath);

		if (!stat.isDirectory() || stat.isSymbolicLink()) {
			return;
		}

		if (depth >= 0) {
			subs.push(filePath);
		}

		const files: string[] = fs.readdirSync(filePath);

		const tasks = files.map(file => enqueue(path.join(filePath, file), depth + 1));

		await Promise.all(tasks);
	};

	await enqueue(path.normalize(root), -1);

	return subs;
}

export default subdirs;
