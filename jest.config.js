module.exports = {
	verbose: true,
	bail: false,
	roots: ["<rootDir>", "<rootDir>/tests/"],
	transform: {
		"^.+\\.tsx?$": "ts-jest"
	},
	globals: {
		"ts-jest": {
			tsConfig: "tests/tsconfig.json"
		}
	}
};
