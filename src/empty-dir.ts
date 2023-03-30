import fs from 'fs-extra';

const emptyDir = async (dir: string, filter: Function): Promise<boolean> => {
	if (!Array.isArray(dir) && typeof dir !== 'string') {
		throw new TypeError('expected a directory or array of files');
	}

	if (Array.isArray(dir)) {
		return isEmpty(dir, filter);
	}

	const stat = await fs.stat(dir);
	if (!stat.isDirectory()) {
		return false;
	}

	const files: string[] = await fs.readdir(dir);

	return isEmpty(files, filter);
}

export default emptyDir;

async function isEmpty(files: string[], filter: Function): Promise<boolean> {
	if (files.length === 0) {
		return true;
	}

	if (typeof filter !== 'function') {
		return false;
	}

	for (const file of files) {
		if (filter(file) === false) {
			return false;
		}
	}
	return true;
}