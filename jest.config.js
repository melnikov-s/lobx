module.exports = {
	verbose: true,
	bail: false,
	roots: ["<rootDir>", "<rootDir>/tests/"],
	transform: {
		"^.+\\.tsx?$": "ts-jest",
	},
	globals: {
		"ts-jest": {
			tsconfig: "tests/tsconfig.json",
		},
	},
};
