# newman-reporter-junitxray-byfolder
Customized Newman JUnit report to industrialize the reporting of E2E test results organized by folders composed of multiple requests.

## Install
> The installation should be global if newman is installed globally, local otherwise. 
(Replace -g from the command below with -S for a local installation)

```console
$ npm install -g newman-reporter-junitxray-byfolder
```
## Usage
In order to enable this reporter, specify `junitxray-byfolder` in Newman's `-r` or `--reporters` option.

```console
newman run collection.json -r junitxray-byfolder --reporter-junitxray-byfolder-export './report/junit.xml'
```

### Options

#### With Newman CLI

| CLI Option  | Description       |
|-------------|-------------------|
| `--reporter-junitxray-byfolder-export <path>` | Specify a path where the output XML file will be written to disk. If not specified, the file will be written to `newman/` in the current working directory. |

#### With Newman as a Library
The CLI functionality is available for programmatic use as well.

```javascript
const newman = require('newman');

newman.run({
    collection: require('collection.json'), // path to a local/remote JSON file.
    reporters: 'junitxray-byfolder',
    reporter: {
        junitxray-byfolder: {
            export: './examples/xray/result.xml', // If not specified, the file will be written to `newman/` in the current working directory.
        }
    },
	iterationCount: 2
}, function (err) {
	if (err) { throw err; }
    console.log('collection run complete!');
});
```

## Compatibility

| **newman-reporter-junitxray-byfolder** | **newman** | **node** |
|:-----------------------------:|:----------:|:--------:|
|            v1.0.0             | >= v4.0.0  | >= v6.x  |

## Troubleshooting

### Reporter not found
The reporter and newman must be installed at the same level, the installation should be global if newman is installed globally, local otherwise.


## License
This software is licensed under MIT. See the [LICENSE](LICENSE) file for more information.