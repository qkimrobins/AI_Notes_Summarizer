// ============================================================================
// AI Notes Summarizer - Modern App Controller
// ============================================================================

const notesInput = document.querySelector("#notesInput");
const topicInputField = document.querySelector("#topicInputField");
const summarizeButton = document.querySelector("#summarizeButton");
const statusMessage = document.querySelector("#statusMessage");
const pulseDot = document.querySelector("#pulseDot");
const wordCount = document.querySelector("#wordCount");
const charCount = document.querySelector("#charCount");
const pdfInput = document.querySelector("#pdfInput");
const fileStatus = document.querySelector("#fileStatus");
const uploadDropZone = document.querySelector("#uploadDropZone");
const fileSelectedBadge = document.querySelector("#fileSelectedBadge");
const removeFileBtn = document.querySelector("#removeFileBtn");
const clearTextBtn = document.querySelector("#clearTextBtn");
const themeToggleBtn = document.querySelector("#themeToggleBtn");
const lastPackBtn = document.querySelector("#lastPackBtn");
const tabModeNotes = document.querySelector("#tabModeNotes");
const tabModeSearch = document.querySelector("#tabModeSearch");
const notesInputSection = document.querySelector("#notesInputSection");
const topicSearchSection = document.querySelector("#topicSearchSection");
const enableGroundingCheckbox = document.querySelector("#enableGroundingCheckbox");

let currentMode = "notes"; // 'notes' | 'search'

// Sample presets (topics & notes)
const PRESETS = {
  biology: {
    title: "Cellular Respiration",
    notes: "Cellular respiration is the biochemical pathway through which cells break down glucose molecules to release energy in the form of ATP (adenosine triphosphate). It primarily takes place within the cytoplasm and mitochondria of eukaryotic cells. The overall process occurs in three main stages: Glycolysis, the Krebs Cycle (Citric Acid Cycle), and the Electron Transport Chain with Oxidative Phosphorylation. Glucose reacts with oxygen to produce carbon dioxide, water, and approximately 30 to 32 ATP molecules. ATP is vital because it powers cellular work including active transport across membranes, muscle contraction, and macromolecule synthesis. Cellular respiration connects directly with photosynthesis, forming a complementary energy cycle in ecosystems."
  },
  cs: {
    title: "Sorting Algorithms & Big-O",
    notes: "Sorting algorithms arrange elements of a list in a specific numerical or lexicographical order. Common comparison-based algorithms include Quicksort, Mergesort, and Heapsort. Quicksort operates on a divide-and-conquer strategy using a pivot element to partition arrays into smaller sub-arrays, achieving an average time complexity of O(n log n) but degrading to O(n^2) in worst-case scenarios. Mergesort is a stable sorting algorithm that repeatedly divides the array in half and merges sorted sub-arrays, consistently guaranteeing O(n log n) time at the expense of O(n) auxiliary memory. Heapsort utilizes a binary heap data structure to achieve in-place O(n log n) sorting. Understanding algorithm stability and spatial complexity is critical for choosing optimal algorithms in high-throughput systems."
  },
  physics: {
    title: "Quantum Mechanics & Superposition",
    notes: "Quantum mechanics is the foundational theory in physics that describes the behavior of matter and energy at atomic and subatomic scales. Unlike classical mechanics, quantum mechanics introduces wave-particle duality, meaning photons and electrons exhibit properties of both waves and particles. Heisenberg's Uncertainty Principle dictates that the position and momentum of a quantum particle cannot be simultaneously measured with arbitrary precision. Quantum superposition allows a quantum system to exist across multiple states simultaneously until measurement causes wave function collapse. Quantum entanglement describes a phenomenon where quantum particles become inextricably linked, such that the state of one instantaneously determines the state of the other regardless of spatial separation."
  },
  history: {
    title: "The Industrial Revolution",
    notes: "The Industrial Revolution marked the profound transition from agrarian, handicraft economies to machine-driven manufacturing between 1760 and 1840. Beginning in Great Britain due to abundant coal deposits, capital accumulation, and colonial trade routes, it introduced the steam engine perfected by James Watt, mechanized textile production via the spinning jenny, and transformed metallurgy. This shift led to rapid urbanization as populations migrated into expanding industrial cities, creating a new urban working class. It also spurred social, political, and economic transformations, fostering modern capitalist systems, labor union movements, and unprecedented demographic growth alongside significant public health challenges."
  },
  mrna: {
    title: "mRNA Vaccines Mechanism",
    notes: "mRNA vaccines represent a breakthrough platform in immunization biotechnology. Instead of injecting weakened or inactivated viral pathogens, mRNA vaccines deliver synthetic messenger RNA encapsulated within lipid nanoparticles (LNPs). Once inside host dendritic and muscle cells, host ribosomes translate the mRNA instructions to produce harmless viral antigen proteins (such as the SARS-CoV-2 Spike protein). The immune system recognizes these foreign surface proteins, activating helper T-cells and cytotoxic T-cells while stimulating B-cells to synthesize neutralizing antibodies. The mRNA molecules do not enter the cell nucleus, never integrate into host genomic DNA, and degrade rapidly through natural cellular enzymatic pathways."
  }
};

// Initialize app
initTheme();
initPresets();
initPdfDropZone();
initLastPackButton();
initModeSwitchers();
updateCounts();

// Event listeners
notesInput.addEventListener("input", updateCounts);
summarizeButton.addEventListener("click", handleSummarize);
pdfInput.addEventListener("change", handlePdfSelection);
clearTextBtn.addEventListener("click", handleClearText);
themeToggleBtn.addEventListener("click", toggleTheme);

if (removeFileBtn) {
  removeFileBtn.addEventListener("click", handleRemoveFile);
}

// ----------------------------------------------------------------------------
// Mode Switchers (Notes vs Google Topic Search)
// ----------------------------------------------------------------------------
function initModeSwitchers() {
  if (!tabModeNotes || !tabModeSearch) return;

  tabModeNotes.addEventListener("click", () => {
    currentMode = "notes";
    tabModeNotes.classList.add("active");
    tabModeSearch.classList.remove("active");
    notesInputSection.classList.remove("hidden");
    topicSearchSection.classList.add("hidden");
    statusMessage.textContent = "Ready for notes or PDF.";
  });

  tabModeSearch.addEventListener("click", () => {
    currentMode = "search";
    tabModeSearch.classList.add("active");
    tabModeNotes.classList.remove("active");
    topicSearchSection.classList.remove("hidden");
    notesInputSection.classList.add("hidden");
    statusMessage.textContent = "Ready for Google topic research.";
    if (topicInputField) topicInputField.focus();
  });
}

// ----------------------------------------------------------------------------
// Theme System (Light / Dark)
// ----------------------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem("app_theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = newTheme;
  localStorage.setItem("app_theme", newTheme);
  updateThemeIcon(newTheme);
  showToast(`Switched to ${newTheme} mode`);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector("#themeIcon");
  if (!icon) return;

  if (theme === "light") {
    // Moon icon for switching back to dark
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  } else {
    // Sun icon for switching to light
    icon.innerHTML = `
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    `;
  }
}

// ----------------------------------------------------------------------------
// Preset Samples
// ----------------------------------------------------------------------------
function initPresets() {
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetKey = btn.getAttribute("data-preset");
      const preset = PRESETS[presetKey];
      if (!preset) return;

      if (currentMode === "search") {
        if (topicInputField) {
          topicInputField.value = preset.title;
          topicInputField.focus();
        }
        statusMessage.textContent = `Preset topic "${preset.title}" loaded.`;
        showToast(`Loaded topic: ${preset.title}`);
      } else {
        notesInput.value = preset.notes;
        updateCounts();
        statusMessage.textContent = `Preset "${preset.title}" loaded. Ready to summarize!`;
        notesInput.focus();
        showToast(`Loaded sample notes: ${preset.title}`);
      }
    });
  });
}

function handleClearText() {
  if (currentMode === "search") {
    if (topicInputField) topicInputField.value = "";
    statusMessage.textContent = "Ready for Google topic research.";
    showToast("Cleared topic query");
    return;
  }

  if (!notesInput.value) return;
  notesInput.value = "";
  updateCounts();
  statusMessage.textContent = "Ready for notes or PDF.";
  showToast("Cleared text input");
}

function initLastPackButton() {
  if (lastPackBtn && localStorage.getItem("summaryData")) {
    lastPackBtn.classList.remove("hidden");
  }
}

// ----------------------------------------------------------------------------
// PDF Dropzone & Selection
// ----------------------------------------------------------------------------
function initPdfDropZone() {
  if (!uploadDropZone) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      uploadDropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      uploadDropZone.classList.remove("drag-over");
    });
  });

  uploadDropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files[0]) {
      if (files[0].type === "application/pdf" || files[0].name.endsWith(".pdf")) {
        pdfInput.files = files;
        handlePdfSelection();
      } else {
        showToast("Please upload a valid PDF file");
      }
    }
  });
}

function handlePdfSelection() {
  const pdfFile = pdfInput.files[0];

  if (!pdfFile) {
    if (fileSelectedBadge) fileSelectedBadge.classList.remove("active");
    if (fileStatus) fileStatus.textContent = "No file selected";
    return;
  }

  const sizeKb = Math.round(pdfFile.size / 1024);
  if (fileStatus) fileStatus.textContent = `📄 ${pdfFile.name} (${sizeKb} KB)`;
  if (fileSelectedBadge) fileSelectedBadge.classList.add("active");
  statusMessage.textContent = `${pdfFile.name} loaded. Click generate below!`;
  showToast(`Selected ${pdfFile.name}`);
}

function handleRemoveFile(e) {
  e.stopPropagation();
  pdfInput.value = "";
  if (fileSelectedBadge) fileSelectedBadge.classList.remove("active");
  if (fileStatus) fileStatus.textContent = "No file selected";
  statusMessage.textContent = "PDF removed. Ready for notes.";
  showToast("Removed PDF attachment");
}

// ----------------------------------------------------------------------------
// Counter Update
// ----------------------------------------------------------------------------
function updateCounts() {
  const text = notesInput.value.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  wordCount.textContent = `${words.toLocaleString()} words`;
  charCount.textContent = `${text.length.toLocaleString()} chars`;
}

// ----------------------------------------------------------------------------
// Main Summarize / Research Request
// ----------------------------------------------------------------------------
async function handleSummarize() {
  const isSearchMode = currentMode === "search";
  const topicQuery = topicInputField ? topicInputField.value.trim() : "";
  const notes = notesInput.value.trim();
  const pdfFile = pdfInput.files[0];
  const enableSearch = enableGroundingCheckbox ? enableGroundingCheckbox.checked : true;

  if (isSearchMode) {
    if (!topicQuery) {
      statusMessage.textContent = "Please enter a topic to search on Google.";
      showToast("Enter a topic name or question first");
      if (topicInputField) topicInputField.focus();
      return;
    }
  } else {
    if (!notes && !pdfFile) {
      statusMessage.textContent = "Please paste notes or upload a PDF first.";
      showToast("Paste notes or upload a PDF to continue");
      notesInput.focus();
      return;
    }
  }

  setLoadingState(true, isSearchMode);

  try {
    const requestBody = {
      enableSearch
    };

    if (isSearchMode) {
      statusMessage.textContent = `🔍 Querying Google Search for "${topicQuery}"...`;
      requestBody.topic = topicQuery;
      requestBody.topicOnly = true;
    } else {
      requestBody.notes = notes;
      if (pdfFile) {
        statusMessage.textContent = "Reading PDF document...";
        requestBody.pdfBase64 = await readFileAsBase64(pdfFile);
        requestBody.fileName = pdfFile.name;
      }
      if (enableSearch) {
        statusMessage.textContent = "🔍 Grounding notes with Google Search...";
      } else {
        statusMessage.textContent = "Synthesizing revision pack...";
      }
    }

    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("Server returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error(payload.message || payload.error || "Unable to summarize notes.");
    }

    // Save and redirect
    localStorage.setItem("summaryData", JSON.stringify(payload));
    statusMessage.textContent = "Pack ready! Loading results...";
    showToast("Revision pack generated successfully!");

    setTimeout(() => {
      window.location.href = "/result.html";
    }, 300);

  } catch (error) {
    console.error(error);
    statusMessage.textContent = error.message || "Something went wrong.";
    showToast(error.message || "Processing failed. Check input.");
  } finally {
    setLoadingState(false, isSearchMode);
  }
}

function setLoadingState(isLoading, isSearchMode = false) {
  summarizeButton.disabled = isLoading;
  if (pulseDot) {
    pulseDot.classList.toggle("working", isLoading);
  }

  const btnText = summarizeButton.querySelector(".btn-text");
  const btnIcon = summarizeButton.querySelector(".btn-icon");

  if (isLoading) {
    if (btnIcon) btnIcon.innerHTML = `<div class="spinner"></div>`;
    if (btnText) btnText.textContent = isSearchMode ? "Researching on Google..." : "Generating Pack...";
  } else {
    if (btnIcon) btnIcon.textContent = "✨";
    if (btnText) btnText.textContent = "Generate Revision Pack";
  }
}

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

// ----------------------------------------------------------------------------
// Toast Notification Helper
// ----------------------------------------------------------------------------
function showToast(message) {
  let container = document.querySelector("#toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast-item";
  toast.innerHTML = `<span>✨ ${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}


