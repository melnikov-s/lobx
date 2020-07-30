module.exports = {
	presets: ["@babel/env"],
	env: {
		test: {
			presets: [
				[
					"@babel/preset-env",
					{
						targets: {
							node: "current"
						}
					}
				]
			]
		}
	}
};
