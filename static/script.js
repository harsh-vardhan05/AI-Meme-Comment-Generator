document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const uploadZone = document.getElementById("upload-zone");
  const mediaInput = document.getElementById("media-input");
  const uploadPrompt = document.getElementById("upload-prompt");
  const mediaPreviewContainer = document.getElementById("media-preview-container");
  const imagePreview = document.getElementById("image-preview");
  const videoPreview = document.getElementById("video-preview");
  const removeMediaBtn = document.getElementById("remove-media");

  const topicInput = document.getElementById("topic-input");
  const modeBtns = document.querySelectorAll(".mode-btn");

  const intensitySlider = document.getElementById("intensity-slider");
  const intensityVal = document.getElementById("intensity-val");
  const intensityLabel = document.getElementById("intensity-label");
  const sliderProgress = document.getElementById("slider-progress");
  const sliderThumb = document.getElementById("slider-thumb");

  const generateBtn = document.getElementById("generate-btn");
  const btnText = document.getElementById("btn-text");
  const outputArea = document.getElementById("output-area");
  const loadingSkeletons = document.getElementById("loading-skeletons");

  // State
  let currentMediaData = null; // Base64 string
  let currentMediaType = null; // MIME type e.g. image/jpeg
  let currentMode = "Caption";

  // --- 1. Mode Selection ---
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeBtns.forEach((b) => {
        b.classList.remove("active-mode");
        b.classList.add("text-slate-400");
        b.classList.remove("text-white");
      });
      btn.classList.add("active-mode");
      btn.classList.remove("text-slate-400");
      btn.classList.add("text-white");
      currentMode = btn.dataset.mode;
    });
  });

  // --- 2. Intensity Slider ---
  const updateSlider = () => {
    const val = parseInt(intensitySlider.value, 10);
    intensityVal.innerText = val;

    const labels = {
      1: "Very Mild",
      2: "Mild",
      3: "Playful",
      4: "Witty",
      5: "Sarcastic",
      6: "Edgy",
      7: "Snarky",
      8: "Dark",
      9: "Unhinged",
      10: "Chaos",
    };
    intensityLabel.innerText = labels[val] || "Witty";

    const percent = ((val - 1) / 9) * 100;
    sliderProgress.style.width = `${percent}%`;
    sliderThumb.style.left = `calc(${percent}% - 10px)`;
  };
  intensitySlider.addEventListener("input", updateSlider);
  updateSlider();

  // Helper: Extract JPEG frame from video file
  const extractVideoFrame = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        video.currentTime = Math.min(1.0, video.duration / 2 || 0);
      };

      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      };

      video.onerror = (e) => reject(e);
    });
  };

  // --- 3. Media Upload & Drag-and-Drop ---
  const handleMedia = async (file) => {
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      alert("Please upload an image or video file.");
      return;
    }

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target.result;
        currentMediaType = file.type;
        currentMediaData = result.split(",")[1];

        uploadPrompt.classList.add("hidden");
        mediaPreviewContainer.classList.remove("hidden");
        imagePreview.src = result;
        imagePreview.classList.remove("hidden");
        videoPreview.classList.add("hidden");
      };
      reader.readAsDataURL(file);
    } else if (isVideo) {
      const objectUrl = URL.createObjectURL(file);
      uploadPrompt.classList.add("hidden");
      mediaPreviewContainer.classList.remove("hidden");
      videoPreview.src = objectUrl;
      videoPreview.classList.remove("hidden");
      imagePreview.classList.add("hidden");

      try {
        const frameDataUrl = await extractVideoFrame(file);
        currentMediaType = "image/jpeg";
        currentMediaData = frameDataUrl.split(",")[1];
      } catch (err) {
        console.warn("Could not extract video frame, reading as raw base64:", err);
        const reader = new FileReader();
        reader.onload = (e) => {
          currentMediaType = file.type;
          currentMediaData = e.target.result.split(",")[1];
        };
        reader.readAsDataURL(file);
      }
    }
  };

  mediaInput.addEventListener("change", (e) => {
    handleMedia(e.target.files[0]);
  });

  removeMediaBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    mediaInput.value = "";
    currentMediaData = null;
    currentMediaType = null;
    mediaPreviewContainer.classList.add("hidden");
    uploadPrompt.classList.remove("hidden");
    imagePreview.src = "";
    videoPreview.src = "";
  });

  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.firstElementChild.nextElementSibling.classList.add("bg-blue-900/40", "border-cyan-400");
  });
  uploadZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    uploadZone.firstElementChild.nextElementSibling.classList.remove("bg-blue-900/40", "border-cyan-400");
  });
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.firstElementChild.nextElementSibling.classList.remove("bg-blue-900/40", "border-cyan-400");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMedia(e.dataTransfer.files[0]);
    }
  });

  // --- 4. Event Delegation for Copy Buttons (Avoid Inline String Escaping Bugs) ---
  outputArea.addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".copy-btn");
    if (!copyBtn) return;

    const textToCopy = copyBtn.getAttribute("data-copy-text");
    if (!textToCopy) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      const icon = copyBtn.querySelector("i") || copyBtn;
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-green-400"></i>`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        if (window.lucide) window.lucide.createIcons();
      }, 2000);
    });
  });

  // --- 5. Generate API Call ---
  generateBtn.addEventListener("click", async () => {
    const topic = topicInput.value.trim();
    const intensity = intensitySlider.value;

    if (!topic && !currentMediaData) {
      alert("Please enter a topic or upload an image/video!");
      return;
    }

    // UI Loading state
    generateBtn.disabled = true;
    btnText.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Analyzing & Generating...`;
    if (window.lucide) window.lucide.createIcons();
    outputArea.innerHTML = "";
    outputArea.classList.add("hidden");
    loadingSkeletons.classList.remove("hidden");

    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          media_data: currentMediaData,
          media_type: currentMediaType,
          mode: currentMode,
          intensity: intensity,
        }),
      });

      const data = await response.json();

      loadingSkeletons.classList.add("hidden");
      outputArea.classList.remove("hidden");

      if (response.ok) {
        renderResults(data.results, currentMode);
      } else {
        showError(data.error || "Failed to generate content.");
      }
    } catch (err) {
      loadingSkeletons.classList.add("hidden");
      outputArea.classList.remove("hidden");
      showError("Network error. Could not connect to the backend server.");
    } finally {
      generateBtn.disabled = false;
      btnText.innerHTML = `Generate Meme Magic ✨`;
    }
  });

  function renderResults(results, mode) {
    if (!results || results.length === 0) {
      showError("No results generated. Try adjusting your topic or image!");
      return;
    }

    let html = "";
    results.forEach((item) => {
      if (mode === "Both") {
        const captionText = item.caption || "";
        const commentText = item.comment || "";
        const fullCopy = `Caption: ${captionText}\nComment: ${commentText}`;

        html += `
          <div class="bg-navy-800/80 border border-white/10 rounded-2xl p-5 relative group hover:border-cyan-500/50 transition-colors shadow-lg">
            <div class="mb-3">
              <span class="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1 block">Caption</span>
              <p class="text-white text-lg font-medium pr-10">${escapeHTML(captionText)}</p>
            </div>
            <div class="pt-3 border-t border-white/10">
              <span class="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1 block">Comment</span>
              <p class="text-slate-300 pr-10">${escapeHTML(commentText)}</p>
            </div>
            <button class="copy-btn absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer" title="Copy Both" data-copy-text="${escapeAttribute(fullCopy)}">
              <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
          </div>
        `;
      } else {
        const text = typeof item === "string" ? item : item.caption || item.comment || "";
        html += `
          <div class="bg-navy-800/80 border border-white/10 rounded-2xl p-5 relative group hover:border-cyan-500/50 transition-colors shadow-lg flex items-center justify-between gap-4">
            <p class="text-white text-lg font-medium leading-snug">${escapeHTML(text)}</p>
            <button class="copy-btn shrink-0 p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer" title="Copy" data-copy-text="${escapeAttribute(text)}">
              <i data-lucide="copy" class="w-5 h-5"></i>
            </button>
          </div>
        `;
      }
    });

    outputArea.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  function showError(msg) {
    outputArea.innerHTML = `
      <div class="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
        <i data-lucide="alert-triangle" class="w-8 h-8 text-red-400 mx-auto mb-2"></i>
        <p class="text-red-200">${escapeHTML(msg)}</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
});
