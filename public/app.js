const notesInput = document.querySelector("#notesInput");
const summarizeButton = document.querySelector("#summarizeButton");
const statusMessage = document.querySelector("#statusMessage");
const wordCount = document.querySelector("#wordCount");
const charCount = document.querySelector("#charCount");
const pdfInput = document.querySelector("#pdfInput");
const fileStatus = document.querySelector("#fileStatus");

// Event listeners
notesInput.addEventListener("input", updateCounts);
summarizeButton.addEventListener("click", handleSummarize);
pdfInput.addEventListener("change", handlePdfSelection);

updateCounts();

// 🔥 MAIN FUNCTION
async function handleSummarize() {
  const notes = notesInput.value.trim();
  const pdfFile = pdfInput.files[0];

  // ❗ validation
  if (!notes && !pdfFile) {
    statusMessage.textContent = "Please paste notes or upload a PDF.";
    return;
  }

  summarizeButton.disabled = true;
  statusMessage.textContent = "Building your revision pack...";

  try {
    const requestBody = { notes };

    // 📄 handle PDF
    if (pdfFile) {
      requestBody.pdfBase64 = await readFileAsBase64(pdfFile);
      requestBody.fileName = pdfFile.name;
    }

    // 🚨 IMPORTANT: route must match backend
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    // ❗ handle non-JSON safely
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Server returned an invalid response.");
    }

    // ❗ handle backend errors
    if (!response.ok) {
      throw new Error(payload.message || payload.error || "Unable to summarize your notes.");
    }

    // ✅ Save result
    localStorage.setItem("summaryData", JSON.stringify(payload));

    // ✅ Redirect
    window.location.href = "/result.html";

  } catch (error) {
    console.error(error);
    statusMessage.textContent = error.message || "Something went wrong.";
  } finally {
    summarizeButton.disabled = false;
  }
}

// 📄 PDF selection UI
function handlePdfSelection() {
  const pdfFile = pdfInput.files[0];

  if (!pdfFile) {
    fileStatus.textContent = "No PDF selected.";
    return;
  }

  fileStatus.textContent = `${pdfFile.name} selected. Ready to summarize.`;
}

// 🔢 word + char counter
function updateCounts() {
  const text = notesInput.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  wordCount.textContent = `${words} words`;
  charCount.textContent = `${text.length} chars`;
}

// 📄 convert PDF → base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("Couldn't read the PDF file."));
    };

    reader.readAsDataURL(file);
  });
}
