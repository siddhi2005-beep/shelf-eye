// Walmart Shelf-Eye Client Operations Controller
const overviewUrl = "/api/overview";
const $ = (selector) => document.querySelector(selector);

// -------------------------------------------------------------
// 1. Procedural HTML5 Web Audio Synthesizer System
// -------------------------------------------------------------
let audioCtx = null;
let isMuted = true;

function initAudio() {
  if (audioCtx) return;
  // Create audio context supporting most browsers
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();
}

function playSynthSound(type) {
  if (isMuted) return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  
  switch(type) {
    case 'click': {
      // Soft mechanical frequency drop
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    }
    case 'scan': {
      // Ascending retro sci-fi scanner sweep
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(1300, now + 0.6);
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      // Filter out high-frequency screeching
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.6);
      break;
    }
    case 'alert': {
      // Dual-tone urgent repeating alarm chime
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc1.type = 'square';
      osc2.type = 'sine';
      
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(660, now + 0.12);
      osc1.frequency.setValueAtTime(880, now + 0.24);
      
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(330, now + 0.12);
      osc2.frequency.setValueAtTime(440, now + 0.24);
      
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.38);
      osc2.stop(now + 0.38);
      break;
    }
    case 'print': {
      // Mechanical printer receipt chirp
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.setValueAtTime(1200, now + 0.05);
      osc.frequency.setValueAtTime(1600, now + 0.10);
      osc.frequency.setValueAtTime(1300, now + 0.15);
      
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
      break;
    }
  }
}

// Bind audio toggle event
$("#sound-toggle").addEventListener("click", () => {
  isMuted = !isMuted;
  const toggle = $("#sound-toggle");
  if (isMuted) {
    toggle.classList.remove("playing");
    $(".sound-label").textContent = "AUDIO: OFF";
    playSynthSound('click');
  } else {
    initAudio();
    toggle.classList.add("playing");
    $(".sound-label").textContent = "AUDIO: ON";
    playSynthSound('click');
  }
});

// -------------------------------------------------------------
// 2. High-Tech Typewriter Agent Log Console
// -------------------------------------------------------------
const terminal = $("#terminal-output");

function addTerminalLine(text, type = "info") {
  const line = document.createElement("div");
  line.className = `terminal-line ${type}`;
  line.innerHTML = `<span class="term-prompt">&gt;</span> `;
  terminal.appendChild(line);
  
  // Typewriter effect per character
  let i = 0;
  function typeChar() {
    if (i < text.length) {
      line.innerHTML += text.charAt(i);
      i++;
      setTimeout(typeChar, 8);
    } else {
      terminal.scrollTop = terminal.scrollHeight;
    }
  }
  typeChar();
}

// -------------------------------------------------------------
// 3. Draggable CRT Swipe Split-Slider
// -------------------------------------------------------------
const splitSlider = $("#split-slider");
const rawPane = $("#raw-pane");
const splitHandle = $("#split-handle");
let isDragging = false;

function setSplitPosition(xPos) {
  const rect = splitSlider.getBoundingClientRect();
  let percentage = ((xPos - rect.left) / rect.width) * 100;
  percentage = Math.max(0, Math.min(percentage, 100)); // Clamp 0 - 100
  
  splitHandle.style.left = `${percentage}%`;
  rawPane.style.width = `${percentage}%`;
}

splitHandle.addEventListener("mousedown", () => {
  isDragging = true;
});

window.addEventListener("mouseup", () => {
  isDragging = false;
});

window.addEventListener("mousemove", (event) => {
  if (!isDragging) return;
  setSplitPosition(event.clientX);
});

// Touch controls for mobile compatibility
splitHandle.addEventListener("touchstart", () => {
  isDragging = true;
});

window.addEventListener("touchend", () => {
  isDragging = false;
});

window.addEventListener("touchmove", (event) => {
  if (!isDragging) return;
  setSplitPosition(event.touches[0].clientX);
});

// -------------------------------------------------------------
// 4. Synchronize Interactive 3D Retail Shelf Map
// -------------------------------------------------------------
function sync3DShelf(alerts) {
  // Reset all rack slot gap visual overlays
  document.querySelectorAll(".shelf-slot").forEach(slot => {
    slot.classList.remove("empty");
    const ring = slot.querySelector(".empty-glow-ring");
    if (ring) ring.remove();
    
    // Unhide items if hidden
    const item3d = slot.querySelector(".shelf-3d-item");
    if (item3d) item3d.style.display = "block";
  });

  // Highlight empty gaps from active open alerts
  alerts.forEach(alert => {
    if (alert.status !== "open") return;
    
    if (alert.product.includes("Milk")) {
      const slot = $("#slot-milk-empty");
      slot.classList.add("empty");
      if (!slot.querySelector(".empty-glow-ring")) {
        const ring = document.createElement("div");
        ring.className = "empty-glow-ring";
        slot.prepend(ring);
      }
    } else if (alert.product.includes("Orange") || alert.product.includes("Juice")) {
      const slot = $("#slot-juice-empty");
      slot.classList.add("empty");
      if (!slot.querySelector(".empty-glow-ring")) {
        const ring = document.createElement("div");
        ring.className = "empty-glow-ring";
        slot.prepend(ring);
      }
    } else {
      const slot = $("#slot-produce-empty");
      slot.classList.add("empty");
      if (!slot.querySelector(".empty-glow-ring")) {
        const ring = document.createElement("div");
        ring.className = "empty-glow-ring";
        slot.prepend(ring);
      }
    }
  });
}

// -------------------------------------------------------------
// 5. Interactive Stock Sliders (Digital Twin Simulator)
// -------------------------------------------------------------
const milkSlider = $("#sim-milk");
const juiceSlider = $("#sim-juice");
const appleSlider = $("#sim-apple");

function updateSliderBadge(slider, badgeId, itemsClass) {
  const value = slider.value;
  $(`#${badgeId}`).textContent = `${value}%`;
  
  // Set badge color depending on level
  const badge = $(`#${badgeId}`);
  if (value > 50) {
    badge.className = "neon-green";
  } else if (value > 20) {
    badge.className = "neon-yellow";
  } else {
    badge.className = "neon-red";
  }

  // Animate 3D shelf items based on level
  const items = document.querySelectorAll(itemsClass);
  if (value == 0) {
    items.forEach(it => it.style.display = "none");
  } else if (value < 50) {
    if (items.length > 0) items[0].style.display = "none";
    if (items.length > 1) items[1].style.display = "block";
  } else {
    items.forEach(it => it.style.display = "block");
  }
}

milkSlider.addEventListener("input", () => {
  updateSliderBadge(milkSlider, "val-milk", "#slot-milk-1 .shelf-3d-item, #slot-milk-2 .shelf-3d-item");
  playSynthSound('click');
});

juiceSlider.addEventListener("input", () => {
  updateSliderBadge(juiceSlider, "val-juice", "#slot-juice-1 .shelf-3d-item");
  playSynthSound('click');
});

appleSlider.addEventListener("input", () => {
  updateSliderBadge(appleSlider, "val-apple", "#slot-apple-1 .shelf-3d-item");
  playSynthSound('click');
});

// Trigger a mock planogram layout drift in the simulator
$("#sim-trigger-drift").addEventListener("click", async () => {
  playSynthSound('click');
  
  // Instantly reduce milk and juice levels to simulate stock drop
  milkSlider.value = 0;
  juiceSlider.value = 0;
  updateSliderBadge(milkSlider, "val-milk", "#slot-milk-1 .shelf-3d-item, #slot-milk-2 .shelf-3d-item");
  updateSliderBadge(juiceSlider, "val-juice", "#slot-juice-1 .shelf-3d-item");

  addTerminalLine("Manual Simulator Event: Simulating store planogram layout drift...", "warning");
  
  setTimeout(() => {
    playSynthSound('scan');
    addTerminalLine("Vision core triggered. Scanning dairy and beverage bay cameras...", "info");
  }, 600);

  setTimeout(async () => {
    // Generate a mock alert by creating a subscriber alert, or utilizing existing FastAPI subscriber lists
    addTerminalLine("Vision Inference: Identified out-of-stock gap in DAIRY BAY (A14) and BEVERAGE BAY (B02)!", "warning");
    playSynthSound('alert');
    
    // Pre-populate forms and submit a sample to register actual data on backend
    $("#analysis-form").store_id.value = "WM-101";
    $("#analysis-form").aisle.value = "Aisle A14 - Dairy / Beverage Aisle";
    
    // Simulate raw/processed images by loading the dairy-empty mock image preset
    loadMockChannel("dairy-empty", true);
  }, 1400);
});

// -------------------------------------------------------------
// 6. Base64 SVG High-Res Mock Images for Offline Channels
// -------------------------------------------------------------
const mockSVGs = {
  "stocked-all": `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%230c1228"/><path d="M 0,130 L 600,130 M 0,260 L 600,260" stroke="%231e293b" stroke-width="6"/><text x="15" y="30" fill="%2300f0ff" font-family="monospace" font-size="12">CCTV CH_04: STOCKED</text><g transform="translate(40, 30)"><rect x="0" y="0" width="35" height="80" fill="%230071dc" rx="4"/><rect x="5" y="10" width="25" height="40" fill="%23ffffff"/><rect x="50" y="0" width="35" height="80" fill="%230071dc" rx="4"/><rect x="55" y="10" width="25" height="40" fill="%23ffffff"/><rect x="100" y="0" width="35" height="80" fill="%230071dc" rx="4"/><rect x="105" y="10" width="25" height="40" fill="%23ffffff"/><rect x="250" y="20" width="30" height="60" fill="%23ffeb3b" rx="2"/><rect x="350" y="10" width="40" height="70" fill="%23ff8800" rx="6"/></g><g transform="translate(40, 160)"><rect x="0" y="0" width="30" height="80" fill="%23ff2222" rx="15"/><rect x="40" y="0" width="30" height="80" fill="%23ff2222" rx="15"/><rect x="80" y="0" width="30" height="80" fill="%23ff2222" rx="15"/><rect x="200" y="10" width="35" height="70" fill="%23ff8800" rx="4"/><rect x="250" y="10" width="35" height="70" fill="%23ff8800" rx="4"/></g><g transform="translate(40, 290)"><circle cx="20" cy="30" r="22" fill="%23ff3333"/><circle cx="80" cy="30" r="22" fill="%23ffbb00"/><circle cx="140" cy="30" r="22" fill="%2344aa44"/></g></svg>`,
  
  "dairy-empty": `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%230c1228"/><path d="M 0,130 L 600,130 M 0,260 L 600,260" stroke="%231e293b" stroke-width="6"/><text x="15" y="30" fill="%23ff2a5f" font-family="monospace" font-size="12">CCTV CH_04: ANOMALY</text><g transform="translate(40, 30)"><rect x="0" y="0" width="35" height="80" fill="%230071dc" rx="4"/><rect x="5" y="10" width="25" height="40" fill="%23ffffff"/><rect x="250" y="20" width="30" height="60" fill="%23ffeb3b" rx="2"/><rect x="350" y="10" width="40" height="70" fill="%23ff8800" rx="6"/></g><g transform="translate(40, 160)"><rect x="0" y="0" width="30" height="80" fill="%23ff2222" rx="15"/><rect x="40" y="0" width="30" height="80" fill="%23ff2222" rx="15"/><rect x="200" y="10" width="35" height="70" fill="%23ff8800" rx="4"/><rect x="250" y="10" width="35" height="70" fill="%23ff8800" rx="4"/></g><g transform="translate(40, 290)"><circle cx="20" cy="30" r="22" fill="%23ff3333"/><circle cx="140" cy="30" r="22" fill="%2344aa44"/></g></svg>`,

  "juice-empty": `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%230c1228"/><path d="M 0,130 L 600,130 M 0,260 L 600,260" stroke="%231e293b" stroke-width="6"/><text x="15" y="30" fill="%23ff2a5f" font-family="monospace" font-size="12">CCTV CH_04: ANOMALY</text><g transform="translate(40, 30)"><rect x="0" y="0" width="35" height="80" fill="%230071dc" rx="4"/><rect x="5" y="10" width="25" height="40" fill="%23ffffff"/><rect x="50" y="0" width="35" height="80" fill="%230071dc" rx="4"/><rect x="55" y="10" width="25" height="40" fill="%23ffffff"/><rect x="100" y="0" width="35" height="80" fill="%230071dc" rx="4"/><rect x="105" y="10" width="25" height="40" fill="%23ffffff"/></g><g transform="translate(40, 160)"><rect x="0" y="0" width="30" height="80" fill="%23ff2222" rx="15"/><rect x="200" y="10" width="35" height="70" fill="%23ff8800" rx="4"/></g><g transform="translate(40, 290)"><circle cx="20" cy="30" r="22" fill="%23ff3333"/><circle cx="80" cy="30" r="22" fill="%23ffbb00"/></g></svg>`
};

const mockSVGsProcessed = {
  "stocked-all": `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%230c1228"/><path d="M 0,130 L 600,130 M 0,260 L 600,260" stroke="%231e293b" stroke-width="6"/><g transform="translate(40, 30)"><rect x="-5" y="-5" width="45" height="90" fill="none" stroke="%2300ff66" stroke-width="2"/><text x="-5" y="-10" fill="%2300ff66" font-family="sans-serif" font-size="8">MILK 98%</text><rect x="45" y="-5" width="45" height="90" fill="none" stroke="%2300ff66" stroke-width="2"/><text x="45" y="-10" fill="%2300ff66" font-family="sans-serif" font-size="8">MILK 95%</text></g><text x="15" y="30" fill="%2300ff66" font-family="monospace" font-size="12">ANALYSIS COMPLETE: ALL STOCKED</text></svg>`,
  
  "dairy-empty": `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%230c1228"/><path d="M 0,130 L 600,130 M 0,260 L 600,260" stroke="%231e293b" stroke-width="6"/><g transform="translate(40, 30)"><rect x="75" y="-5" width="160" height="95" fill="none" stroke="%23ff2a5f" stroke-width="3"/><text x="75" y="-12" fill="%23ff2a5f" font-family="sans-serif" font-weight="bold" font-size="10">EMPTY MILK GAP 92%</text></g><text x="15" y="30" fill="%23ff2a5f" font-family="monospace" font-size="12">ALERT: DAIRY GAP DETECTED</text></svg>`,

  "juice-empty": `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%230c1228"/><path d="M 0,130 L 600,130 M 0,260 L 600,260" stroke="%231e293b" stroke-width="6"/><g transform="translate(40, 160)"><rect x="75" y="-5" width="115" height="95" fill="none" stroke="%23ff2a5f" stroke-width="3"/><text x="75" y="-12" fill="%23ff2a5f" font-family="sans-serif" font-weight="bold" font-size="10">EMPTY JUICE GAP 85%</text></g><text x="15" y="30" fill="%23ff2a5f" font-family="monospace" font-size="12">ALERT: JUICE GAP DETECTED</text></svg>`
};

// Handle preset channel button clicks
async function loadMockChannel(channelName, isSimulated = false) {
  if (!isSimulated) playSynthSound('click');
  
  // Highlight chosen channel button
  document.querySelectorAll(".channel-btn").forEach(btn => {
    btn.classList.remove("neon-blue-btn");
  });
  const activeBtn = $(`.channel-btn[data-channel="${channelName}"]`);
  if (activeBtn) activeBtn.classList.add("neon-blue-btn");

  // Show split slider frame structure
  $("#split-placeholder").style.display = "none";
  $("#processed-image").src = mockSVGsProcessed[channelName];
  $("#processed-image").style.display = "block";
  $("#raw-image").src = mockSVGs[channelName];
  $("#raw-image").style.display = "block";
  
  // Reset split slider percentage handle to middle
  splitHandle.style.left = "50%";
  rawPane.style.width = "50%";

  if (isSimulated) return; // Slider click handles its own detailed terminal outputs

  playSynthSound('scan');
  addTerminalLine(`Manual Input: Channel preset [${channelName.toUpperCase()}] selected.`, "info");
  
  setTimeout(() => {
    addTerminalLine("AI Inference: Scanning frame with YOLOv8n and planogram Canny filter...", "info");
  }, 400);

  setTimeout(async () => {
    if (channelName === "stocked-all") {
      addTerminalLine("AI Inference: Shelf fully stocked. All planogram items matched correctly.", "success");
      await refreshOverview();
    } else {
      const product = channelName === "dairy-empty" ? "Great Value 2% Milk" : "Great Value Orange Juice";
      addTerminalLine(`AI Inference: Detected out-of-stock anomaly zone for [${product.toUpperCase()}].`, "warning");
      playSynthSound('alert');
      
      // We will perform a real backend analysis trigger using simulated forms to trigger active alerts in the DB!
      // This bridges our awesome UI mockup seamlessly with the actual FastAPI database!
      // Let's create a simulated upload that updates the database via backend endpoints!
      const mockBlob = new Blob([mockSVGs[channelName]], { type: 'image/svg+xml' });
      const mockFile = new File([mockBlob], `${channelName}.svg`, { type: 'image/svg+xml' });
      
      const payload = new FormData();
      payload.append("file", mockFile);
      
      const params = new URLSearchParams({
        store_id: "WM-101",
        aisle: channelName === "dairy-empty" ? "Aisle A14 - Dairy" : "Aisle B02 - Beverages",
      });

      const response = await fetch(`/api/analyze-image?${params}`, {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (response.ok) {
        addTerminalLine(`Autonomous Agent: Registered Alert ${result.alerts[0]?.id || "alert"}!`, "success");
        addTerminalLine(`Autonomous Agent: Drafted DC Restock Order ${result.restock_orders[0]?.id || "order"}!`, "success");
        playSynthSound('print');

        // Print alert notifications routed to subscribers
        if (result.notifications && result.notifications.length > 0) {
          result.notifications.forEach(note => {
            const channelLabel = note.channel === "email" ? "📧 EMAIL" : "📱 SMS";
            addTerminalLine(`[ALERT ROUTED] Simulated message sent via ${channelLabel} to ${note.subscriber_name || 'Contact'} (${note.destination}): "${note.message}"`, "success");
          });
        }

        await refreshOverview();
      }
    }
  }, 1000);
}

document.querySelectorAll(".channel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    loadMockChannel(btn.dataset.channel);
  });
});

// -------------------------------------------------------------
// 7. Core FastAPI Dashboard Synchronisation
// -------------------------------------------------------------
async function refreshOverview() {
  const response = await fetch(overviewUrl);
  const data = await response.json();
  
  $("#open-alerts").textContent = data.kpis.open_alerts;
  $("#orders-count").textContent = data.kpis.restock_orders;
  $("#subscriber-count").textContent = data.kpis.subscribers;
  $("#notification-count").textContent = data.kpis.notifications_sent;
  
  renderAlerts(data.alerts);
  renderOrders(data.restock_orders);
  renderSubscribers();
  sync3DShelf(data.alerts);
}

function renderAlerts(alerts) {
  $("#alerts-list").innerHTML = alerts.length
    ? alerts
        .map(
          (alert) => `
            <div class="event">
              <strong>${alert.product}</strong>
              <small>${alert.store_id} / ${alert.aisle} / ${new Date(alert.created_at).toLocaleString()}</small>
              <p>${alert.message}</p>
              <span class="tag ${alert.severity}">${alert.severity} · ${Math.round(alert.confidence * 100)}% confidence</span>
              <button class="cyber-btn btn-secondary tag-action-btn" onclick="acknowledgeAlert('${alert.id}')" style="margin-top: 8px; font-size:9px; min-height:24px; padding: 2px 8px;">
                ${alert.status === 'open' ? 'Acknowledge' : alert.status.toUpperCase()}
              </button>
            </div>
          `,
        )
        .join("")
    : `<div class="event"><strong>No open alerts yet</strong><small>Run the vision agent or click a mock channel to trigger.</small></div>`;
}

async function acknowledgeAlert(alertId) {
  playSynthSound('click');
  addTerminalLine(`Acknowledging Alert ${alertId}...`, "info");
  const response = await fetch(`/api/alerts/${alertId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "acknowledged" })
  });
  if (response.ok) {
    addTerminalLine(`Alert ${alertId} successfully acknowledged.`, "success");
    await refreshOverview();
  }
}

function renderOrders(orders) {
  $("#orders-list").innerHTML = orders.length
    ? orders
        .map(
          (order) => `
            <div class="event">
              <strong>${order.product}</strong>
              <small>${order.sku} / ${order.distribution_center}</small>
              <p>Quantity ${order.quantity} drafted from alert ${order.alert_id}.</p>
              <span class="tag drafted">${order.status}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="event"><strong>No restock drafts yet</strong><small>Orders appear after an empty shelf is detected.</small></div>`;
}

async function renderSubscribers() {
  const listEl = $("#subscriber-list");
  if (!listEl) return;
  const response = await fetch("/api/subscribers");
  const subscribers = await response.json();
  listEl.innerHTML = subscribers
    .map(
      (subscriber) => `
        <div class="contact">
          <strong>${subscriber.name}</strong>
          <small>${subscriber.email || "No email"} · ${subscriber.phone || "No phone"}</small>
        </div>
      `,
    )
    .join("");
}

// -------------------------------------------------------------
// 8. Form Submissions & File Drag-Drop Event Bindings
// -------------------------------------------------------------
$("#analysis-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  playSynthSound('click');
  
  const form = event.currentTarget;
  const payload = new FormData(form);
  const params = new URLSearchParams({
    store_id: payload.get("store_id"),
    aisle: payload.get("aisle"),
  });
  
  addTerminalLine("Web Upload: New shelf camera frame received. Initiating Vision Agent...", "info");
  playSynthSound('scan');
  
  // Set placeholder loading states
  $("#split-placeholder").style.display = "none";
  $("#summary").textContent = "Analyzing frame, drawing boxes, and asking the agent to act...";

  const response = await fetch(`/api/analyze-image?${params}`, {
    method: "POST",
    body: payload,
  });
  const result = await response.json();
  if (!response.ok) {
    addTerminalLine(`Vision Error: ${result.detail || "Analysis failed."}`, "warning");
    $("#summary").textContent = result.detail || "Analysis failed.";
    return;
  }

  // Load split slider preview
  const image = $("#processed-image");
  image.src = `${result.processed_image}?t=${Date.now()}`;
  image.style.display = "block";
  
  // Raw uploaded preview (using FileReader locally for instant speed!)
  const fileInput = $("#file-input");
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      $("#raw-image").src = e.target.result;
      $("#raw-image").style.display = "block";
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    $("#raw-image").src = result.processed_image;
    $("#raw-image").style.display = "block";
  }

  splitHandle.style.left = "50%";
  rawPane.style.width = "50%";

  // Complete logs & sounds
  const alertCount = result.alerts.length;
  if (alertCount > 0) {
    addTerminalLine(`Vision Inference: Found ${alertCount} empty shelf gap!`, "warning");
    playSynthSound('alert');
    addTerminalLine(`Autonomous Agent: Generated alert logs and drafted ${result.restock_orders.length} restock replenishment database entries.`, "success");
    playSynthSound('print');

    // Print alert notifications routed to subscribers
    if (result.notifications && result.notifications.length > 0) {
      result.notifications.forEach(note => {
        const channelLabel = note.channel === "email" ? "📧 EMAIL" : "📱 SMS";
        addTerminalLine(`[ALERT ROUTED] Simulated message sent via ${channelLabel} to ${note.subscriber_name || 'Contact'} (${note.destination}): "${note.message}"`, "success");
      });
    }
  } else {
    addTerminalLine("Vision Inference: Planogram verification complete. All shelves adequately stocked.", "success");
  }

  $("#summary").textContent = result.summary;
  await refreshOverview();
});

$("#subscriber-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  playSynthSound('click');
  
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form));
  payload.store_id = "WM-101";
  
  addTerminalLine(`Subscriber: Registering alert routing rules for [${payload.name}]...`, "info");

  const response = await fetch("/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.ok) {
    form.reset();
    addTerminalLine(`Subscriber: [${payload.name}] successfully configured for alerts (Hidden from UI).`, "success");
    await refreshOverview();
  } else {
    addTerminalLine("Subscriber Error: Failed to register contact.", "warning");
  }
});

// File Drag & Drop hover animations
const dropZone = $("#file-drop-zone");
const fileInput = $("#file-input");

dropZone.addEventListener("click", () => {
  fileInput.click();
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    addTerminalLine(`File Drop: Selected [${e.dataTransfer.files[0].name}] for analysis.`, "info");
    playSynthSound('click');
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    addTerminalLine(`File Picked: Selected [${fileInput.files[0].name}] for analysis.`, "info");
    playSynthSound('click');
  }
});

$("#demo-fill").addEventListener("click", () => {
  playSynthSound('click');
  $("#analysis-form").store_id.value = "WM-101";
  $("#analysis-form").aisle.value = "Aisle A14 - Dairy";
  addTerminalLine("Demo Metadata loaded into form inputs.", "info");
});

// Clock topbar ticker
setInterval(() => {
  const clock = $("#clock");
  if (clock) {
    clock.textContent = new Date().toLocaleTimeString();
  }
}, 1000);

// Initialize metrics
refreshOverview();
window.acknowledgeAlert = acknowledgeAlert;
