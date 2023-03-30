module.exports = {
	ignorePatterns: ['!.eslintrc.js', 'dist', 'lib/*', 'coverage', 'docs'],
	extends: ['@circle9r/eslint-config'],
	parserOptions: {
		sourceType: 'module',
		project: './tsconfig.json',
	},
	overrides: [
		{
			files: ['*.ts'],
			rules: {
				'no-console': ['off'],
			},
		},
	],
};
