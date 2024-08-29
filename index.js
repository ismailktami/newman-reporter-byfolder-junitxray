const fs = require("fs");
const xmlbuilder = require("xmlbuilder");
const prefixTestPattern = /^[A-Za-z]+-\d+/;

// Function to check if a request already exists in the array to avoid duplicates
function requestExists(requests, requestName) {
  return requests.some((request) => request.name === requestName);
}

// Class for generating a JUnit report from a Postman collection run based on folders
class JUnitReporterByFolder {
  constructor(emitter, reporterOptions) {
    // Listen for the 'done' event which indicates the collection run is complete
    emitter.on("done", (err, summary) => {
      if (err) {
        console.error("Error running collection:", err);
        return;
      }
      // Create the root XML element
      const report = xmlbuilder.create("testsuites");
      const folders = {};

      // Process each execution in the run
      summary.run.executions.forEach((execution) => {
        const folderName = execution.item.parent().name;
        const match = folderName.match(prefixTestPattern);
        console.log(match)
        if (!match & (folderName !== summary.collection.name)) return;

        // Initialize folder details if not already present
        if (!folders[folderName]) {
          folders[folderName] = {
            name: folderName,
            tests: 0,
            failures: 0,
            errors: 0,
            skipped: 0,
            requests: [],
          };
        }

        // Create request details
        const requestDetail = this.createRequestDetail(execution);
        // Check for duplicate requests before adding
        if (!requestExists(folders[folderName].requests, requestDetail.name))
          folders[folderName].requests.push(requestDetail);

        folders[folderName].tests += 1;
      });

      // Process each folder to create test cases and test suites
      this.processFolders(summary, folders, report);

      // Generate the XML string and save the JUnit XML report
      const xmlString = report.end({ pretty: true });
      this.saveXML(reporterOptions.junitxrayByfolderExport || "junitxray-byfolder.xml", xmlString);
    });
  }

  // Create request details from execution
  createRequestDetail(execution) {
    return {
      name: execution.item.name,
      time: (execution.response ? execution.response.responseTime : 0) / 1000,
      status: execution.response ? execution.response.status : "No Response",
      code: execution.response ? execution.response.code : "No Code",
      assertions: execution.assertions
        ? execution.assertions.map((assertion) => ({
            name: assertion.assertion,
            error: assertion.error
              ? {
                  name: assertion.error.name,
                  message: assertion.error.message,
                  stack: assertion.error.stack,
                }
              : null,
          }))
        : [],
    };
  }

  // Process each folder to create test cases and test suites
  processFolders(summary, folders, report) {
    Object.keys(folders).forEach((folderName) => {
      const folder = folders[folderName];
      folder.name =
        folderName === summary.collection.name
          ? folder.requests[0].name
          : folder.name;
      console.log(folder.name);

      const match = folder.name.match(prefixTestPattern);
      if (!match & (folder.name !== summary.collection.name)) return;

      // Create a testsuite element
      const testsuite = report.ele("testsuite", {
        name:
          folderName === summary.collection.name
            ? folderName
            : folder.name.split(match[0])[1].trimStart().trimEnd(),
        tests: 1, // Each folder is considered a single test
        failures: folder.failures,
        errors: folder.errors,
        skipped: folder.skipped,
      });

      // Create a testcase element
      const testcase = testsuite.ele("testcase", {
        name: folder.name.split(match[0])[1].trimStart().trimEnd(),
        time: folder.requests.reduce((total, req) => total + req.time, 0),
      });

      let details = "Requests :";
      let totalFailures = 0;

      // Process each request within the folder
      folder.requests.forEach((request, index) => {
        details +=
          "\n\t\t" +
          `Request ${index + 1}: ${request.name} -- Status: ${
            request.status
          } -- Code: ${request.code} -- Time: ${request.time}s`;
        request.assertions.forEach((assertion) => {
          if (assertion.error) {
            if (details.indexOf("Failures") < 0) details += "\nFailures:";
            details += `\n\t\tmessage: ${assertion.error.message} -- type: ${assertion.error.name}  -- stack : ${assertion.error.stack}`;
            totalFailures++;
            testcase
              .ele("failure", {
                message: assertion.error.message,
                type: assertion.error.name,
              })
              .dat(assertion.error.stack);
          }
        });
        details += "\n";
      });

      // Add properties to the testcase
      const properties = testcase.ele("properties");
      properties.ele("property", {
        name: "test_key",
        value: match ? match[0] : folderName,
      });
      properties.ele("property", { name: "testrun_comment" }).dat(details);

      testcase.att("failures", totalFailures);
      testsuite.att("failures", totalFailures);
    });
  }

  // Save the JUnit XML report
  saveXML(filePath, xmlString) {
    try {
      fs.writeFileSync(filePath, xmlString);
    } catch (error) {
      console.error(`Error saving XML to ${filePath}:`, error);
    }
  }
}
module.exports = JUnitReporterByFolder;
