import { EventEmitter } from 'events';
import fs from 'fs-extra';
import { glob } from 'glob';
import path from 'path';
import { rimraf } from 'rimraf';
import emptyDir from './empty-dir';
import subdirs from './subdirs';
import Utils, { Patterns } from './utils';

const defaults = {
	/**
	 * The directory to search in, default is `process.cwd()`
	 * @type {String}
	 */
	cwd: process.cwd(),
	/**
	 * Array of patterns plugins to use. Default is `['default:safe']`.
	 * @type {Array}
	 */
	patterns: ['default:safe'],
	/**
	 * Array of additional patterns to use.
	 * @type {Array}
	 */
	additionalPatterns: [],
	/**
	 * Ignore the provided glob patterns
	 * @type {Array|null}
	 */
	ignorePatterns: null,
	/**
	 * Exclude directories from being removed
	 * @type {Boolean}
	 */
	noDirs: false,
	/**
	 * Ignore the case of the file names when searching by patterns (default `true`)
	 * @type {Boolean}
	 */
	ignoreCase: true,
	/**
	 * Include dot files in the search (default `true`)
	 * @type {Boolean}
	 */
	dotFiles: true,
	/**
	 * Function (async or sync) to call before each file is deleted to give ability to prevent deletion. (Optional, default `null`)
	 * If called with 3 arguments (file, files, cb) it's async and `cb` must be called with a result (`false` skips file).
	 * If called with 1 or 2 arguments (file, files) it's sync and `return false` will skip the file.
	 * @type {Function|null}
	 */
	process: null,
	/**
	 * The folder name used for storing modules. Used to append to `options.cwd` if running in parent directory (default `"node_modules"`)
	 * @type {String}
	 */
	modulesDir: 'node_modules',
	/**
	 * Remove empty directories as part of the cleanup process (default `true`)
	 * @type {Boolean}
	 */
	removeEmptyDirs: true,
	/**
	 * Filter function used when checking if a directory is empty
	 * @param  {String}  file File name to filter against
	 * @return {Boolean}      `true` if is a valid file, `false` if invalid file
	 */
	emptyDirFilter: function(file: string): boolean {
		if (/Thumbs\.db$/i.test(file) || /\.DS_Store$/i.test(file)) {
			return true;
		}

		return false;
	},
	/**
	 * Whether file deletion errors should halt the module from running and return the error to the callback (default `false`)
	 * @type {Boolean}
	 */
	errorHalt: false,
	/**
	 * Use test mode which will get the list of files and run the process without actually deleting the files (default `false`)
	 * @type {Boolean}
	 */
	test: false,
	/**
	 * Force deletion to be done also in symlinked packages (when using npm link) (default `false`)
	 * @type {Boolean}
	 */
	followSymlink: false,
};

/**
 * @class ModClean
 * @extends {EventEmitter}
 */
export class ModClean extends EventEmitter {

	utils: Utils;
	errors: any[];
	options: any;
	_patterns: Patterns;

	/**
	 * Initalizes ModClean class with provided options. If `cb` is provided, it will start `clean()`.
	 * @param  {Object}   options Options to configure ModClean
	 */
	constructor(options: any) {
		super();

		this.utils = new Utils(this);
		this.errors = [];

		this.options = Object.assign({}, modclean.defaults, options && typeof options === 'object' ? options : {});

		this._patterns = this.utils.initPatterns(this.options);

		if (this.options.modulesDir !== false && path.basename(this.options.cwd) !== this.options.modulesDir) {
			this.options.cwd = path.join(this.options.cwd, this.options.modulesDir);
		}
	}

	/**
	 * Automated clean process that finds and deletes items based on the ModClean options.
	 */
	async clean(): Promise<void> {
		const opts = this.options;

		this.emit('start');

		try {
			const files = await this._find();

			await this._process(files);

			if (opts.removeEmptyDirs) {
				await this.cleanEmptyDirs();
			}
		} catch (error) {
			// ignore
		}

		this.emit('complete');
	}

	/**
	 * Finds files/folders based on the ModClean options.
	 * @private
	 */
	async _find(): Promise<string[]> {
		const opts = this.options;
		const globOpts = {
			cwd: opts.cwd,
			dot: opts.dotFiles,
			nocase: opts.ignoreCase,
			ignore: this._patterns.ignore,
			nodir: opts.noDirs,
		};

		this.emit('beforeFind', this._patterns.allow, globOpts);

		try {
			const files = await glob(`**/@(${this._patterns.allow.join('|')})`, globOpts);
			this.emit('files', files);
			return files;
		} catch (error) {
			this.utils.error(error, '_find');
		}
		return [];
	}

	/**
	 * Processes the found files and deletes the ones that pass `options.process`.
	 * @private
	 * @param  {Array}    files List of file paths to process.
	 */
	async _process(files: string[]): Promise<string[]> {
		const opts = this.options;
		const processFn = typeof opts.process === 'function' ? opts.process : function() {
			return true;
		};
		const results: string[] = [];

		if (!files.length) {
			return [];
		}

		this.emit('process', files);

		for (const file of files) {
			const processFile = async () => {
				const shouldProcess = await processFn(file);
				if (shouldProcess !== false) {
					try {
						await this._deleteFile(file);
						results.push(file);
					} catch (error) {
						// ?
					}
				}
			};

			if (opts.followSymlink) {
				await processFile();
			} else {
				let shouldNext = false;
				try {
					const stat = await fs.lstat(path.join(opts.cwd, path.parse(file).dir));
					if (!stat.isSymbolicLink()) {
						shouldNext = true;
					}
				} catch (error) {
					shouldNext = true;
				}
				if (shouldNext) {
					await processFile();
				}
			}
		}
		/**
		 * @event finish
		 * @property {Array} results List of files successfully deleted
		 */
		this.emit('finish', results);
		return results;
	}

	/**
	 * Deletes a single file/folder from the filesystem.
	 * @private
	 * @param  {String}   file File path to delete.
	 */
	async _deleteFile(file: string): Promise<void> {
		const opts = this.options;

		try {
			// If test mode is enabled, just return the file.
			if (!opts.test) {
				await rimraf(path.join(opts.cwd, file));
			}
			this.emit('deleted', file);
		} catch (error) {
			this.utils.error(error, '_deleteFile', { file }, 'fileError');
		}
	}

	/**
	 * Finds and removes all empty directories.
	 */
	async cleanEmptyDirs(): Promise<string[]> {
		const opts = this.options;
		const results: any[] = [];

		// If test mode is enabled or removeEmptyDirs is disabled, just return.
		if (opts.test || !opts.removeEmptyDirs) {
			return [];
		}

		this.emit('beforeEmptyDirs');

		const dirs: string[] = await this._findEmptyDirs();

		await this._removeEmptyDirs(dirs);

		this.emit('afterEmptyDirs', results);

		return dirs;
	}

	/**
	 * Finds all empty directories within `options.cwd`.
	 * @private
	 */
	async _findEmptyDirs(): Promise<string[]> {
		const results: string[] = [];

		try {
			const dirs = await subdirs(this.options.cwd);
			if (!Array.isArray(dirs)) {
				throw new Error('Dir not array');
			}

			for (const dir of dirs) {
				try {
					const isEmpty = await emptyDir(dir, this.options.emptyDirFilter || function() {
						return false;
					});
					if (!isEmpty) {
						continue;
					}
					results.push(dir);
				} catch (error) {
					this.utils.error(error, '_findEmptyDirs');
					throw error;
				}
			}
			this.emit('emptyDirs', results);
		} catch (error) {
			this.utils.error(error, '_findEmptyDirs');
		}
		return results;
	}

	/**
	 * Removes all empty directories provided in `dirs`.
	 * @private
	 * @param  {Array}    dirs List of empty directories to remove.
	 */
	async _removeEmptyDirs(dirs: string[]) {
		const results = [];

		for (const dir of dirs) {
			try {
				await rimraf(dir);
				results.push(dir);
				this.emit('deletedEmptyDir', dir);
			} catch (error) {
				this.utils.error(error, '_removeEmptyDirs', { dir }, 'emptyDirError');
			}
		}
	}

}

// export modclean
export default modclean;

/**
 * Shortcut for calling `new ModClean(options, cb).clean()`
 * @param  {Object}   options Options to set for ModClean (Optional)
 * @return {Object}           New ModClean instance
 */
function modclean(options: any) {
	return new ModClean(options);
}

/**
 * The default options for ModClean that can be overridden.
 * @property {Object} options Default options for ModClean.
 */
modclean.defaults = defaults;
