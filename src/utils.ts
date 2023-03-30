import { uniq } from 'lodash';
import path from 'path';

export interface Patterns {
	allow: string[];
	ignore: string[];
}

export default class ModClean_Utils {
	_inst: any;

	constructor(inst: any) {
		this._inst = inst;
	}

	/**
	 * Initializes patterns based on the configuration
	 * @param  {Object} opts Options object for ModClean
	 * @return {Object}      The compiled and loaded patterns
	 */
	initPatterns(opts: any): Patterns {
		let patDefs: string[] = opts.patterns;
		let patterns: string[] = [];
		let ignore: string[] = [];

		if (!Array.isArray(patDefs)) patDefs = [patDefs];

		for (const patDef of patDefs) {
			const def = patDef.split(':');
			const moduleName = String(def[0]);
			let name: string[] | string | undefined = def[1];
			const loader = this._loadPatterns(moduleName);

			const mod = loader.module;
			const results = loader.patterns;

			const all = Object.keys(results).filter(val => val[0] !== '$');

			if (!name) {
				if (results.$default) {
					name = String(results.$default);
				} else {
					name = all[0];
				}
			}

			if (name === '*') {
				name = all;
			}

			let rules = Array.isArray(name) ? name : String(name).split(',');

			for (const rule of rules) {
				if (!results.hasOwnProperty(rule)) throw new Error(`Module "${mod}" does not contain rule "${rule}"`);
				const obj = results[rule] as any;

				if (Array.isArray(obj)) {
					patterns = patterns.concat(obj);
					continue;
				}

				if (typeof obj === 'object') {
					if (obj.hasOwnProperty('patterns')) patterns = patterns.concat(obj.patterns);
					if (obj.hasOwnProperty('ignore')) ignore = ignore.concat(obj.ignore);
				}
			}
		}

		const addlPats = opts.additionalPatterns;
		const addlIgnore = opts.ignorePatterns;

		if (Array.isArray(addlPats) && addlPats.length) patterns = patterns.concat(addlPats);
		if (Array.isArray(addlIgnore) && addlIgnore.length) ignore = ignore.concat(addlIgnore);

		patterns = uniq(patterns);
		ignore = uniq(ignore);

		if (!patterns.length) throw new Error('No patterns have been loaded, nothing to check against');

		const result: Patterns = {
			allow: patterns,
			ignore,
		};
		return result;
	}

	/**
	 * Parses pattern configuration item and attempts to load it
	 * @param  {String} module Module name or path to load
	 * @return {Object}        Object containing the found module name and the loaded patterns
	 */
	_loadPatterns(module: string): { module: string, patterns: Record<string, unknown> } {
		let patterns;

		if (module.indexOf('/') !== -1) {
			let ext = path.extname(module);
			if (!path.isAbsolute(module)) module = path.resolve(process.cwd(), module);

			if (ext === '.js' || ext === '.json') patterns = require(module);
			else throw new Error(`Invalid pattern module "${module}" provided`);
		} else {
			if (module.match(/modclean\-patterns\-/) === null) module = 'modclean-patterns-' + module;

			try {
				patterns = require(module);
			} catch (e) {
				throw new Error(`Unable to find patterns plugin "${module}", is it installed?`);
			}
		}

		if (patterns === null || typeof patterns !== 'object')
			throw new Error(`Patterns "${module}" did not return an object`);

		return {
			module,
			patterns
		};
	}

	/**
	 * Stores error details and emits error event
	 * @param  {Error}  err    Error object
	 * @param  {String} method Method in which the error occurred
	 * @param  {Object} obj    Optional object to combine into the stored error object
	 * @param  {String} event  Event name to emit, `false` disables
	 * @return {Object}        The compiled error object
	 */
	error(err: any, method: any, obj = {}, event = 'error' as any) {
		let errObj = Object.assign({
			error: err,
			method: method
		}, obj || {});

		this._inst.errors.push(errObj);
		if (event !== false) this._inst.emit(event, errObj);

		return errObj;
	}
}
