const typescript = require("rollup-plugin-typescript2");

module.exports = {
  input: "src/index.ts",
  plugins: [typescript()],
  output: {
    file: "lib/lobx.js",
    format: "umd",
    name: "lobx",
    sourcemap: true
  }
};
