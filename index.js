const fs = require("fs");
const xmlbuilder = require("xmlbuilder");
const prefixTestPattern = /^[A-Za-z]+-\d+/;

class Folder {
  constructor(name) {
    this.name = name;
    this.tests = 0;
    this.failures = 0;
    this.errors = 0;
    this.skipped = 0;
    this.requests = [];
  }
}

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
      const skippedExecutions=[];
      // Process each execution in the run
      summary.run.executions.forEach((execution) => {

        // Determine if this is a valid folder or request to include in the report
        let folderName = execution.item.parent().name;
        const matchFolderName = folderName.match(prefixTestPattern);
        const matchRequestName = execution.item.name.match(prefixTestPattern);
        if (matchFolderName) {
          if (!folders[execution.item.parent().name]) {
            folders[execution.item.parent().name] = new Folder(
              execution.item.parent().name
            );
          }
        } 
        else if (
          matchRequestName &&
          execution.item.parent().name == summary.collection.name
        ) {
          folderName = execution.item.name;
          folders[execution.item.name] = new Folder(execution.item.name);
        } 
        else if (
          matchRequestName &&
          execution.item.parent().name != summary.collection.name
        ) {
          folderName = execution.item.name;
          folders[execution.item.name] = new Folder(execution.item.name);
        } 
        else {
          skippedExecutions.push(folderName +"/"+execution.item.name)
          return;// Skip if the folder or request name doesn't have the prefix key project
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
      this.saveXML(
        reporterOptions.junitxrayByfolderExport || "junitxray-byfolder.xml",
        xmlString
      );
      console.warn("[junitxray-byfolder] Skipped executions for the report:\n" + skippedExecutions.join("\n"));
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
      const match = folder.name.match(prefixTestPattern);
      // Skip folders without matching pattern
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
        name: "test_key", // add test_key prefix to report
        value: match ? match[0] : folderName,
      });
      properties.ele("property", { name: "testrun_comment" }).dat(details);

      testcase.att("failures", totalFailures); // Add total failures to the testcase
      testsuite.att("failures", totalFailures); // Add total failures to the testsuite
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