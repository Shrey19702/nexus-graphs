import { init } from "./app.js";

init().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to load report";
  const report = document.getElementById("report");
  if (report) {
    report.innerHTML = `<p class="error">Could not build the report. Check the console and ensure the local server is running.</p>`;
  }
});
