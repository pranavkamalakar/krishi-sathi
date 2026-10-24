"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Issue = {
  title: string;
  confidence: string;
  cause: string;
  actions: string[];
  caution: string;
};

type CameraState = "off" | "starting" | "live";
type Facing = "environment" | "user";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1280;

const crops = [
  { name: "Tomato", icon: "🍅", tip: "Water at the base in the morning. Remove lower leaves that touch soil." },
  { name: "Chilli", icon: "🌶️", tip: "Keep soil lightly moist, never waterlogged. Check the underside of leaves weekly." },
  { name: "Cotton", icon: "🌿", tip: "Keep the field clean of weeds and inspect tender leaves for sucking pests." },
  { name: "Rice", icon: "🌾", tip: "Observe yellowing patches early; maintain balanced water instead of over-flooding." },
];

const issues: Record<string, Issue> = {
  yellow: { title: "Possible nutrient stress", confidence: "Common pattern", cause: "Uniform yellowing can happen from overwatering, low nitrogen, or poor drainage.", actions: ["Check that water drains within a few hours.", "Add mature compost around the plant, not against the stem.", "If new leaves stay pale after 7 days, consult a local agriculture officer for a soil test."], caution: "Do not add strong fertilizer until you check watering and drainage." },
  spots: { title: "Possible leaf spot", confidence: "Needs a closer check", cause: "Brown or dark spots often spread faster when leaves remain wet for long periods.", actions: ["Remove only badly affected leaves with clean scissors.", "Water the soil, not the leaves.", "Give plants more spacing for airflow and monitor every 2 days."], caution: "If spots spread quickly or cover most leaves, show a fresh sample to an agriculture expert." },
  pest: { title: "Possible pest damage", confidence: "Common pattern", cause: "Curled, sticky, or chewed leaves can indicate aphids, whiteflies, or caterpillars.", actions: ["Inspect leaf undersides in the early morning.", "Hand-remove visible caterpillars where practical.", "Use a locally approved neem-based spray only as directed on its label."], caution: "Do not mix pesticides or use a treatment meant for a different crop." },
  default: { title: "Plant needs observation", confidence: "Photo received", cause: "A photo alone cannot confirm a disease safely. Symptoms, crop stage, weather, and soil conditions matter.", actions: ["Choose the closest symptom below for practical first steps.", "Take a clear photo of both leaf sides and the whole plant.", "Note when it started and whether nearby plants have the same issue."], caution: "For a fast-spreading problem, contact a local agriculture officer before applying treatment." },
};

function Icon({ children }: { children: React.ReactNode }) { return <span aria-hidden="true">{children}</span>; }

function cameraMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera access was blocked. Allow the camera for this site in your browser settings, or upload a photo instead.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No usable camera was found on this device.";
  if (name === "NotReadableError") return "Another app is already using the camera. Close it and try again.";
  return "Could not open the live camera on this device.";
}

/** Shrinks large phone photos so the upload stays inside the 8 MB route limit and stays fast. */
async function shrinkImage(file: File) {
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_IMAGE_EDGE / longestEdge);
    if (scale === 1 && file.size <= 1_600_000) { bitmap.close(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "crop-photo"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [selectedIssue, setSelectedIssue] = useState("default");
  const [selectedCrop, setSelectedCrop] = useState(crops[0]);
  const [showResult, setShowResult] = useState(false);
  const [aiResult, setAiResult] = useState<Issue | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>("off");
  const [cameraError, setCameraError] = useState("");
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const result = useMemo(() => aiResult ?? issues[selectedIssue], [aiResult, selectedIssue]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stopDefault = (event: Event) => event.preventDefault();
    window.addEventListener("dragover", stopDefault);
    window.addEventListener("drop", stopDefault);
    return () => {
      window.removeEventListener("dragover", stopDefault);
      window.removeEventListener("drop", stopDefault);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (cameraState === "live" && video && streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => {});
    }
  }, [cameraState]);

  function showPreview(file: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    setPreview(previewUrlRef.current);
  }

  function failAnalysis(message: string) {
    setAiResult(null);
    setIsAnalysing(false);
    setAnalysisError(message);
    setShowResult(true);
  }

  async function analysePhoto(original: File) {
    if (!original.type.startsWith("image/")) {
      setFileName(original.name);
      setRetryFile(null);
      failAnalysis("That file is not an image. Use a JPG, PNG, or WEBP crop photo.");
      return;
    }
    setFileName(original.name);
    setRetryFile(original);
    showPreview(original);
    setShowResult(true);
    setAiResult(null);
    setAnalysisError("");
    setIsAnalysing(true);

    const file = await shrinkImage(original);
    if (file.size > MAX_UPLOAD_BYTES) {
      failAnalysis("This photo is larger than 8 MB. Take a smaller photo or reduce its size.");
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);
    try {
      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({})) as { guidance?: Issue; error?: string };
      if (!response.ok || !data.guidance) {
        failAnalysis(data.error ?? "Could not analyse this image. Try a clearer crop photo or use manual symptom guidance.");
        return;
      }
      setAiResult(data.guidance);
      setIsAnalysing(false);
    } catch {
      failAnalysis("Could not reach the image-analysis service. Check your connection and try again, or use the symptom buttons.");
    }
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void analysePhoto(file);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragActive(true); }
  function onDragLeave(event: DragEvent<HTMLDivElement>) { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/")) ?? event.dataTransfer.files[0];
    if (file) void analysePhoto(file);
  }
  function onDropzoneKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInputRef.current?.click(); }
  }

  async function openCamera(mode: Facing = facing) {
    setCameraError("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraState("off");
      setCameraError(window.isSecureContext ? "This browser cannot open a live camera." : "A live camera needs a secure (https) connection. On the deployed site it works normally.");
      return;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setCameraState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setFacing(mode);
      setCameraState("live");
    } catch (error) {
      streamRef.current = null;
      setCameraState("off");
      setCameraError(cameraMessage(error));
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("off");
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setCameraError("The camera is still warming up. Try again in a second."); return; }
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) { setCameraError("Could not capture a frame from this camera."); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setCameraError("Could not capture a frame from this camera."); return; }
      stopCamera();
      void analysePhoto(new File([blob], `camera-capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  function analyse(symptom: string) { setSelectedIssue(symptom); setAiResult(null); setAnalysisError(""); setShowResult(true); }

  return (
    <main>
      <nav className="nav"><a className="brand" href="#top"><span>🌱</span> Krishi Sathi</a><div className="navlinks"><a href="#diagnose">Diagnose</a><a href="#soil">Soil care</a><a href="#crops">Crop guide</a></div><a className="navcta" href="#diagnose">Get help <span>→</span></a></nav>
      <section className="hero" id="top">
        <div className="heroCopy"><p className="eyebrow">For farmers and home gardeners</p><h1>Plant care,<br /><em>made simple.</em></h1><p className="lead">Drop a crop photo, snap one with your camera, or choose what you see, and get practical next steps for healthier plants and soil.</p><a className="primary" href="#diagnose">Check my crop <span>→</span></a><p className="trust"><Icon>✓</Icon> Simple guidance &nbsp; <Icon>✓</Icon> Soil-first approach &nbsp; <Icon>✓</Icon> No sign-up</p></div>
        <div className="heroVisual"><div className="sun"/><div className="hill hillBack"/><div className="hill hillFront"/><div className="plant"><span className="leaf leafA">◒</span><span className="leaf leafB">◒</span><span className="stem"/><span className="pot">▰</span></div><div className="floatCard cardOne">🍃 <b>Crop check</b><small>Easy next steps</small></div><div className="floatCard cardTwo">♻️ <b>Soil friendly</b><small>Organic basics</small></div></div>
      </section>
      <section className="steps"><p className="eyebrow">How it works</p><div className="stepGrid"><article><span className="number">01</span><h3>Share a photo</h3><p>Drag and drop, upload, or use your camera in daylight.</p></article><article><span className="number">02</span><h3>Choose symptoms</h3><p>Tell us what you can see on the crop.</p></article><article><span className="number">03</span><h3>Take the next step</h3><p>Use simple care and soil guidance.</p></article></div></section>
      <section className="diagnose section" id="diagnose">
        <div className="sectionTitle"><p className="eyebrow">Crop check</p><h2>What does your plant need?</h2><p>Drag and drop a crop photo, capture one with your camera, or upload a file for AI-assisted first-aid guidance. You can also pick the closest symptom. This is not a lab diagnosis.</p></div>
        <div className="diagnosisGrid">
          <div className="uploadPanel">
            {cameraState === "off" ? (
              <div className={dragActive ? "dropzone dragActive" : "dropzone"} role="button" tabIndex={0} aria-label="Upload a crop photo, or drag and drop one here" onClick={() => fileInputRef.current?.click()} onKeyDown={onDropzoneKey} onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
                {preview ? <><img src={preview} alt="Selected crop preview"/>{isAnalysing && <span className="photoScan" aria-hidden="true"/>}</> : <><span className="uploadIcon">↑</span><b><span className="wideCopy">Drag and drop a crop photo</span><span className="narrowCopy">Tap to add a crop photo</span></b><small><span className="wideCopy">or click to upload · </span>JPG, PNG, or WEBP · daylight photos work best</small></>}
                {dragActive && <span className="dropHint">Drop the photo to start the review</span>}
              </div>
            ) : (
              <div className="cameraView">
                <video ref={videoRef} autoPlay playsInline muted className={facing === "user" ? "mirrored" : ""}/>
                {cameraState === "starting" && <span className="cameraStatus">Starting camera…</span>}
                <span className="cameraFrame" aria-hidden="true"/>
              </div>
            )}
            <div className="captureActions">
              {cameraState === "off" ? <>
                <button type="button" className="captureBtn captureMain" onClick={() => fileInputRef.current?.click()}><Icon>⤓</Icon> Upload photo</button>
                <button type="button" className="captureBtn" onClick={() => void openCamera()}><Icon>◉</Icon> Use camera</button>
              </> : <>
                <button type="button" className="captureBtn captureMain" onClick={capturePhoto} disabled={cameraState !== "live"}><Icon>◉</Icon> Capture photo</button>
                <button type="button" className="captureBtn" onClick={() => void openCamera(facing === "environment" ? "user" : "environment")} disabled={cameraState !== "live"}><Icon>⟳</Icon> Flip</button>
                <button type="button" className="captureBtn" onClick={stopCamera}><Icon>✕</Icon> Close</button>
              </>}
            </div>
            {cameraError && <p className="captureNote">{cameraError} <button type="button" className="linkBtn" onClick={() => cameraInputRef.current?.click()}>Use the device camera app instead</button></p>}
            {fileName && <p className="fileName">✓ {fileName} {isAnalysing && "· AI review in progress"}</p>}
            <input ref={fileInputRef} id="photo" className="hiddenInput" type="file" accept="image/*" onChange={onFileInput}/>
            <input ref={cameraInputRef} className="hiddenInput" type="file" accept="image/*" capture="environment" onChange={onFileInput}/>
            <p className="symptomLabel">Or choose what you notice</p>
            <div className="symptoms"><button className={selectedIssue === "yellow" ? "active" : ""} onClick={() => analyse("yellow")}>🟡 Yellow leaves</button><button className={selectedIssue === "spots" ? "active" : ""} onClick={() => analyse("spots")}>🟤 Leaf spots</button><button className={selectedIssue === "pest" ? "active" : ""} onClick={() => analyse("pest")}>🐛 Chewed or curled</button></div>
          </div>
          <aside className="resultPanel">{isAnalysing ? <div className="empty"><div className="analysisLoader" aria-label="Analysing crop image"><span/><span/><span/></div><p className="resultTag">AI crop review</p><h3>Reading visible leaf patterns…</h3><p>Looking for colour changes, spots, and pest damage. This can take a few seconds.</p></div> : analysisError ? <div className="empty errorState"><span>!</span><p className="resultTag">AI unavailable</p><h3>We could not complete the image review.</h3><p>{analysisError}</p><p>You can still use the symptom buttons on the left for manual first-aid guidance.</p>{retryFile && <button type="button" className="captureBtn captureMain retryBtn" onClick={() => void analysePhoto(retryFile)}><Icon>↻</Icon> Try the same photo again</button>}</div> : showResult ? <><p className="resultTag">{aiResult ? "AI image review · verify locally" : "Manual guidance"}</p><h3>{result.title}</h3><p className="confidence">{result.confidence}</p><p>{result.cause}</p><ol>{result.actions.map((action) => <li key={action}>{action}</li>)}</ol><p className="caution"><b>Important:</b> {result.caution}</p></> : <div className="empty"><span>⌁</span><h3>Your guidance will appear here</h3><p>Drop a photo, use your camera, or select a symptom to begin.</p></div>}</aside>
        </div>
      </section>
      <section className="soil section" id="soil"><div className="sectionTitle"><p className="eyebrow">Soil care</p><h2>Protect the soil. Support the crop.</h2><p>Start with these low-cost practices before depending on excess chemical fertilizer.</p></div><div className="soilGrid"><article><div className="soilIcon">♻</div><h3>Use mature compost</h3><p>Mix fully decomposed kitchen or farm compost into topsoil. It improves structure and helps soil hold moisture.</p><span>Best practice: apply in a thin layer</span></article><article><div className="soilIcon">◌</div><h3>Keep soil covered</h3><p>Use dry leaves, straw, or crop residue as mulch. It reduces heat, slows evaporation, and limits weeds.</p><span>Best practice: keep mulch away from the stem</span></article><article><div className="soilIcon">⌁</div><h3>Test before treating</h3><p>Check soil pH and nutrient status through a local soil-testing centre before buying major fertilizer inputs.</p><span>Best practice: keep a simple field record</span></article></div></section>
      <section className="cropGuide section" id="crops"><div className="sectionTitle"><p className="eyebrow">Crop guide</p><h2>Daily care, one crop at a time.</h2></div><div className="cropLayout"><div className="cropTabs">{crops.map((crop) => <button key={crop.name} className={selectedCrop.name === crop.name ? "cropActive" : ""} onClick={() => setSelectedCrop(crop)}><span>{crop.icon}</span>{crop.name}</button>)}</div><article className="cropDetail"><span className="bigCrop">{selectedCrop.icon}</span><div><p className="resultTag">{selectedCrop.name} basics</p><h3>Small checks prevent big problems.</h3><p>{selectedCrop.tip}</p><div className="checklist"><span>✓ Observe leaves twice a week</span><span>✓ Water only when soil needs it</span><span>✓ Keep a note of changes</span></div></div></article></div></section>
      <section className="help"><div><p className="eyebrow">When to ask locally</p><h2>Some crop problems need a field expert.</h2><p>If symptoms spread fast, affect many plants, or return after basic care, show photos and a plant sample to your nearest agriculture office or KVK.</p></div><span className="helpIcon">☏</span></section>
      <footer><a className="brand" href="#top"><span>🌱</span> Krishi Sathi</a><p>Built for the Plant Care and Soil Protection Community Engagement Project.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
