const path = require('path');

module.exports = {
    mode: "development",
    devtool: "inline-source-map",

    entry: {
        content: './src/app/content.ts',
        background: './src/app/background.ts',
        options: './src/ui/options.tsx',
        popup: './src/ui/popup.tsx',
    },

    output: {
        path: path.resolve(__dirname, 'dist/js'),
        filename: '[name].js'
    },

    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    },

    module: {
        rules: [
            {test: /\.tsx?$/, loader: "ts-loader"},
            {test: /\.css$/, use: ['style-loader', 'css-loader']},
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                loader: 'file-loader',
                options: {outputPath: '../images', esModule: false,}
            },
            {test: /\.md$/, use: [{loader: "html-loader"}, {loader: "markdown-loader"}]}
        ]
    },
};
