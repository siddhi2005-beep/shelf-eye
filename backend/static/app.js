const $ = (selector) => document.querySelector(selector);

const api = {
  currentPlanogram: "/api/v2/planogram/current",
  uploadPlanogram: "/api/v2/planogram/upload",
  analyzeCompliance: "/api/v2/analyze-compliance",
};

const state = {
  streamOn: false,
  webcamReady: false,
  timer: null,
  planogram: [],
  simulationTick: 0,
};

const samplePlanogram = {
  items: [
    {
      product_id: "PLANO-MILK-001",
      product_name: "Milk",
      target_aisle_zone: "Shelf_Row_1",
      expected_facings_count: 4,
      relative_bbox: [0.08, 0.14, 0.46, 0.36],
    },
    {
      product_id: "PLANO-CHEESE-001",
      product_name: "Cheese",
      target_aisle_zone: "Shelf_Row_1",
      expected_facings_count: 3,
      relative_bbox: [0.54, 0.14, 0.88, 0.36],
    },
    {
      product_id: "PLANO-MAGGI-001",
      product_name: "Maggi",
      target_aisle_zone: "Shelf_Row_2",
      expected_facings_count: 5,
      relative_bbox: [0.08, 0.56, 0.56, 0.8],
    },
    {
      product_id: "PLANO-PASTA-001",
      product_name: "Pasta",
      target_aisle_zone: "Shelf_Row_2",
      expected_facings_count: 2,
      relative_bbox: [0.64, 0.56, 0.88, 0.8],
    },
  ],
};

function formatRs(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function timestamp() {
  return new Date().toLocaleTimeString("en-IN", { hour12: false });
}

function addLog(text, type = "system") {
  const log = $("#resolution-log");
  const line = document.createElement("div");
  line.className = `terminal-line ${type}`;
  line.textContent = text;
  log.prepend(line);
}

function normalizeBBox(bbox) {
  if (Array.isArray(bbox)) return bbox;
  return [bbox.x_min, bbox.y_min, bbox.x_max, bbox.y_max];
}

function renderPlanogram(items, detections = []) {
  state.planogram = items;
  const detectionMap = new Map(detections.map((item) => [item.product_id, item]));

  $("#planogram-matrix").innerHTML = items
    .map((item) => {
      const match = detectionMap.get(item.product_id);
      const status = match?.status || "target";
      const observed = match ? match.observed_facings_count : item.expected_facings_count;
      const healthClass = status === "compliant" ? "ok" : status === "target" ? "target" : "bad";
      const bbox = normalizeBBox(item.relative_bbox);
      const depth = Math.round((bbox[1] + bbox[3]) * 40);
      const reality =
        status === "target"
          ? "Waiting for first 5s tick"
          : status === "compliant"
            ? `${observed} correctly placed`
            : `${observed} seen, ${Math.max(0, item.expected_facings_count - observed)} variance`;

      return `
        <div class="matrix-slot ${healthClass}" style="--depth:${depth}px">
          <div class="slot-top"></div>
          <div class="slot-face">
            <div class="slot-heading">
              <strong>${item.product_name}</strong>
              <span>${item.target_aisle_zone.replaceAll("_", " ")}</span>
            </div>
            <div class="shelf-facts">
              <div class="comparison-row">
                <small>Target</small>
                <b>${item.expected_facings_count} facings</b>
              </div>
              <div class="comparison-row">
                <small>Current</small>
                <b>${reality}</b>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPlanogramSummary(payload) {
  $("#planogram-summary").innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <span class="text-slate-400">Planogram ID</span>
      <strong class="mono text-cyan-200">${payload.planogram_id}</strong>
    </div>
    <div class="mt-2 flex items-center justify-between gap-3">
      <span class="text-slate-400">Expected Items</span>
      <strong>${payload.total_expected_items}</strong>
    </div>
    <div class="mt-2 flex items-center justify-between gap-3">
      <span class="text-slate-400">Rows</span>
      <strong>Shelf_Row_1 / Shelf_Row_2</strong>
    </div>
  `;
}

function updateMetrics(result) {
  const score = Number(result.compliance_score || 0);
  const previousLeakage = Number($("#leakage-value").dataset.loss || 0);
  const currentLeakage = Number(result.revenue_at_risk_today || 0);

  $("#score-value").textContent = `${score.toFixed(1)}%`;
  $("#score-ring").style.setProperty("--score", score);
  $("#leakage-value").dataset.loss = String(currentLeakage);
  $("#leakage-value").textContent = formatRs(currentLeakage);
  $("#leakage-caption").textContent = `${Number(result.revenue_drop_percent).toFixed(1)}% hourly revenue drop`;
  $("#frame-id").textContent = `${result.frame_id} / ${result.analyzed_at}`;

  if (currentLeakage > previousLeakage) {
    $("#leakage-value").classList.add("revenue-flash");
    setTimeout(() => $("#leakage-value").classList.remove("revenue-flash"), 900);
  }

  const ring = $("#score-ring");
  ring.classList.toggle("warning", score < 90 && score >= 75);
  ring.classList.toggle("danger", score < 75);
  $("#score-posture").textContent = score >= 90 ? "Optimal" : score >= 75 ? "At Risk" : "Critical Drift";
  $("#score-posture").className =
    score >= 90
      ? "text-xl font-bold text-emerald-300"
      : score >= 75
        ? "text-xl font-bold text-amber-300"
        : "text-xl font-bold text-rose-300";
  $("#score-subtext").textContent = `${result.correctly_placed_items}/${result.total_expected_items} expected items correctly placed`;
  $("#matrix-health").textContent = score >= 90 ? "Synchronized" : "Intervention needed";
  $("#matrix-health").className = score >= 90 ? "panel-chip success" : "panel-chip danger";
}

function renderBBoxes(detections) {
  $("#bbox-layer").innerHTML = detections
    .map((detection) => {
      const bbox = detection.relative_bbox;
      const compliant = detection.status === "compliant";
      return `
        <div class="vision-box ${compliant ? "compliant" : "anomaly"}"
          style="left:${bbox[0] * 100}%;top:${bbox[1] * 100}%;width:${(bbox[2] - bbox[0]) * 100}%;height:${(bbox[3] - bbox[1]) * 100}%">
          <span>${compliant ? "CORRECT" : detection.status.replace("_", " ").toUpperCase()}</span>
        </div>
      `;
    })
    .join("");
}

function paintSimulatedFrame() {
  const canvas = $("#sim-canvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  state.simulationTick += 1;

  ctx.fillStyle = "#eef4fb";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#c9d7e6";
  for (const y of [280, 560]) {
    ctx.fillRect(40, y, width - 80, 18);
    ctx.fillStyle = "#9fb4cb";
    ctx.fillRect(40, y + 18, width - 80, 18);
    ctx.fillStyle = "#c9d7e6";
  }

  const colors = {
    Milk: "#0071dc",
    Cheese: "#ffc220",
    Maggi: "#ff6b35",
    Pasta: "#34d399",
  };

  state.planogram.forEach((item, idx) => {
    const [x1, y1, x2, y2] = normalizeBBox(item.relative_bbox);
    const px = x1 * width;
    const py = y1 * height;
    const boxWidth = (x2 - x1) * width;
    const boxHeight = (y2 - y1) * height;
    const missingFacingDrift = (state.simulationTick + idx) % 6 === 0;
    const rowMisplaced = item.product_name === "Maggi" && state.simulationTick % 8 === 0;
    const facings = missingFacingDrift ? Math.max(1, item.expected_facings_count - 2) : item.expected_facings_count;

    for (let i = 0; i < facings; i += 1) {
      const itemWidth = Math.max(34, boxWidth / item.expected_facings_count - 8);
      const drawX = px + i * (itemWidth + 8);
      const drawY = rowMisplaced ? height * 0.18 : py + (missingFacingDrift ? 42 : 8);
      ctx.fillStyle = colors[item.product_name] || "#38bdf8";
      ctx.fillRect(drawX, drawY, itemWidth, boxHeight - 18);
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillRect(drawX + 8, drawY + 16, Math.max(12, itemWidth - 16), 22);
      ctx.fillStyle = "#152238";
      ctx.font = "800 14px Inter";
      ctx.fillText(item.product_name.toUpperCase().slice(0, 6), drawX + 8, drawY + 52);
    }
  });

  ctx.fillStyle = "#152238";
  ctx.font = "800 18px Inter";
  ctx.fillText(`AISLE 3 / ${timestamp()}`, 40, 52);
}

async function captureFrameBlob() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  const video = $("#camera-video");
  if (state.webcamReady && video.videoWidth) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } else {
    paintSimulatedFrame();
    ctx.drawImage($("#sim-canvas"), 0, 0, canvas.width, canvas.height);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

async function analyzeSnapshot() {
  const shell = $("#camera-shell");
  shell.classList.add("snapshot-flash");
  setTimeout(() => shell.classList.remove("snapshot-flash"), 620);
  addLog(`[${timestamp()}] [INFO] 5s Tick: Capturing shelf state...`, "system");

  const blob = await captureFrameBlob();
  const formData = new FormData();
  formData.append("file", blob, `planogram-compliance-${Date.now()}.jpg`);
  const response = await fetch(api.analyzeCompliance, { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok) {
    addLog(`[${timestamp()}] [ALERT] ${result.detail || "Compliance analysis failed."}`, "risk");
    return;
  }

  $("#annotated-frame").src = `${result.processed_image}?t=${Date.now()}`;
  $("#annotated-frame").style.opacity = "0.52";
  $("#last-snapshot").textContent = `Last snapshot ${timestamp()}`;
  updateMetrics(result);
  renderBBoxes(result.detections);
  renderPlanogram(state.planogram, result.detections);

  result.logs.forEach((line) => {
    const type = line.includes("LOSS") ? "risk" : line.includes("ALERT") ? "anomaly" : line.includes("Triggering") ? "action" : "system";
    addLog(line, type);
  });
}

async function startStream() {
  if (state.streamOn) return;
  state.streamOn = true;
  $("#stream-toggle span").textContent = "Stop Stream";
  $("#stream-status").textContent = "Live";
  $("#stream-dot").classList.add("live");
  $("#tickrate").textContent = "5s analysis cycle";
  addLog(`[${timestamp()}] [INFO] Camera loop armed. Capturing every 5 seconds.`, "system");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    $("#camera-video").srcObject = stream;
    state.webcamReady = true;
    $("#sim-canvas").style.opacity = "0";
  } catch {
    state.webcamReady = false;
    $("#sim-canvas").style.opacity = "1";
    addLog(`[${timestamp()}] [INFO] Webcam unavailable. Simulated looping store video engaged.`, "system");
  }

  paintSimulatedFrame();
  await analyzeSnapshot();
  state.timer = setInterval(analyzeSnapshot, 5000);
}

function stopStream() {
  state.streamOn = false;
  $("#stream-toggle span").textContent = "Start Stream";
  $("#stream-status").textContent = "Standby";
  $("#stream-dot").classList.remove("live");
  $("#tickrate").textContent = "5s analysis cycle";
  clearInterval(state.timer);
  const stream = $("#camera-video").srcObject;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  $("#camera-video").srcObject = null;
  state.webcamReady = false;
  addLog(`[${timestamp()}] [INFO] Stream loop paused by operator.`, "system");
}

async function uploadPlanogramFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(api.uploadPlanogram, { method: "POST", body: formData });
  const payload = await response.json();
  if (!response.ok) {
    addLog(`[${timestamp()}] [ALERT] ${payload.detail || "Planogram upload failed."}`, "risk");
    return;
  }
  $("#planogram-name").textContent = file.name;
  renderPlanogram(payload.target_matrix);
  renderPlanogramSummary(payload);
  paintSimulatedFrame();
  addLog(`[${timestamp()}] [INFO] Master planogram loaded with ${payload.total_expected_items} expected items.`, "system");
}

async function loadCurrentPlanogram() {
  const response = await fetch(api.currentPlanogram);
  const payload = await response.json();
  renderPlanogram(payload.target_matrix);
  renderPlanogramSummary(payload);
  paintSimulatedFrame();
  addLog(`[${timestamp()}] [INFO] Ideal Store State loaded: Row 1 Milk/Cheese, Row 2 Maggi/Pasta.`, "system");
}

function bindEvents() {
  $("#stream-toggle").addEventListener("click", () => (state.streamOn ? stopStream() : startStream()));
  $("#snapshot-now").addEventListener("click", analyzeSnapshot);
  $("#load-sample").addEventListener("click", async () => {
    const file = new File([JSON.stringify(samplePlanogram, null, 2)], "ideal-store-state-planogram.json", {
      type: "application/json",
    });
    await uploadPlanogramFile(file);
  });

  const form = $("#planogram-form");
  const input = $("#planogram-file");
  form.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    if (input.files.length) await uploadPlanogramFile(input.files[0]);
  });
  form.addEventListener("dragover", (event) => {
    event.preventDefault();
    form.classList.add("dragging");
  });
  form.addEventListener("dragleave", () => form.classList.remove("dragging"));
  form.addEventListener("drop", async (event) => {
    event.preventDefault();
    form.classList.remove("dragging");
    if (event.dataTransfer.files.length) await uploadPlanogramFile(event.dataTransfer.files[0]);
  });
}

bindEvents();
loadCurrentPlanogram();
setInterval(() => {
  if (!state.webcamReady) paintSimulatedFrame();
}, 800);
if (window.lucide) window.lucide.createIcons();
