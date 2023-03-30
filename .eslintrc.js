module.exports = {
	ignorePatterns: ['!.eslintrc.js', 'dist', 'lib/*', 'coverage', 'docs'],
	extends: ['@circle9r/eslint-config'],
	parserOptions: {
		sourceType: 'module',
		project: './tsconfig.json',
	},
	overrides: [
		{
			files: ['*.ts', '*.js'],
			rules: {
				'no-console': ['off'],
				'no-sync': ['off'],
				'max-lines-per-function': ['off'],
				'@typescript-eslint/no-unsafe-member-access': ['off'],
				'@typescript-eslint/no-unsafe-call': ['off'],
				'@typescript-eslint/no-explicit-any': ['off'],
				'@typescript-eslint/explicit-module-boundary-types': ['off'],
				'@typescript-eslint/explicit-function-return-type': ['off'],
				'@typescript-eslint/no-unsafe-argument': ['off'],
			},
		},
	],
};
