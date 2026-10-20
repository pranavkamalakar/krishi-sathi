"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Issue = {
  title: string;
  confidence: string;
  cause: string;
  actions: string[];
  caution: string;
};

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

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState("");
  const [selectedIssue, setSelectedIssue] = useState("default");
  const [selectedCrop, setSelectedCrop] = useState(crops[0]);
  const [showResult, setShowResult] = useState(false);
  const result = useMemo(() => issues[selectedIssue], [selectedIssue]);

  function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
    setShowResult(true);
  }

  function analyse(symptom: string) { setSelectedIssue(symptom); setShowResult(true); }

  return (
    <main>
      <nav className="nav"><a className="brand" href="#top"><span>🌱</span> Krishi Sathi</a><div className="navlinks"><a href="#diagnose">Diagnose</a><a href="#soil">Soil care</a><a href="#crops">Crop guide</a></div><a className="navcta" href="#diagnose">Get help <span>→</span></a></nav>
      <section className="hero" id="top">
        <div className="heroCopy"><p className="eyebrow">For farmers and home gardeners</p><h1>Plant care,<br /><em>made simple.</em></h1><p className="lead">Upload a crop photo, choose what you see, and get practical next steps for healthier plants and soil.</p><a className="primary" href="#diagnose">Check my crop <span>→</span></a><p className="trust"><Icon>✓</Icon> Simple guidance &nbsp; <Icon>✓</Icon> Soil-first approach &nbsp; <Icon>✓</Icon> No sign-up</p></div>
        <div className="heroVisual"><div className="sun"/><div className="hill hillBack"/><div className="hill hillFront"/><div className="plant"><span className="leaf leafA">◒</span><span className="leaf leafB">◒</span><span className="stem"/><span className="pot">▰</span></div><div className="floatCard cardOne">🍃 <b>Crop check</b><small>Easy next steps</small></div><div className="floatCard cardTwo">♻️ <b>Soil friendly</b><small>Organic basics</small></div></div>
      </section>
      <section className="steps"><p className="eyebrow">How it works</p><div className="stepGrid"><article><span className="number">01</span><h3>Share a photo</h3><p>Take a clear picture in daylight.</p></article><article><span className="number">02</span><h3>Choose symptoms</h3><p>Tell us what you can see on the crop.</p></article><article><span className="number">03</span><h3>Take the next step</h3><p>Use simple care and soil guidance.</p></article></div></section>
      <section className="diagnose section" id="diagnose"><div className="sectionTitle"><p className="eyebrow">Crop check</p><h2>What does your plant need?</h2><p>Start with a photo. Then pick the symptom that looks closest. This is first-aid guidance, not a lab diagnosis.</p></div><div className="diagnosisGrid"><div className="uploadPanel"><label className="dropzone" htmlFor="photo">{preview ? <img src={preview} alt="Uploaded plant preview"/> : <><span className="uploadIcon">↑</span><b>Upload a crop photo</b><small>JPG, PNG, or WEBP · daylight photos work best</small></>}<input id="photo" type="file" accept="image/*" onChange={uploadPhoto}/></label>{fileName && <p className="fileName">✓ {fileName}</p>}<p className="symptomLabel">Or choose what you notice</p><div className="symptoms"><button className={selectedIssue === "yellow" ? "active" : ""} onClick={() => analyse("yellow")}>🟡 Yellow leaves</button><button className={selectedIssue === "spots" ? "active" : ""} onClick={() => analyse("spots")}>🟤 Leaf spots</button><button className={selectedIssue === "pest" ? "active" : ""} onClick={() => analyse("pest")}>🐛 Chewed or curled</button></div></div><aside className="resultPanel">{showResult ? <><p className="resultTag">Guidance</p><h3>{result.title}</h3><p className="confidence">{result.confidence}</p><p>{result.cause}</p><ol>{result.actions.map((action) => <li key={action}>{action}</li>)}</ol><p className="caution"><b>Important:</b> {result.caution}</p></> : <div className="empty"><span>⌁</span><h3>Your guidance will appear here</h3><p>Upload a photo or select a symptom to begin.</p></div>}</aside></div></section>
      <section className="soil section" id="soil"><div className="sectionTitle"><p className="eyebrow">Soil care</p><h2>Protect the soil. Support the crop.</h2><p>Start with these low-cost practices before depending on excess chemical fertilizer.</p></div><div className="soilGrid"><article><div className="soilIcon">♻</div><h3>Use mature compost</h3><p>Mix fully decomposed kitchen or farm compost into topsoil. It improves structure and helps soil hold moisture.</p><span>Best practice: apply in a thin layer</span></article><article><div className="soilIcon">◌</div><h3>Keep soil covered</h3><p>Use dry leaves, straw, or crop residue as mulch. It reduces heat, slows evaporation, and limits weeds.</p><span>Best practice: keep mulch away from the stem</span></article><article><div className="soilIcon">⌁</div><h3>Test before treating</h3><p>Check soil pH and nutrient status through a local soil-testing centre before buying major fertilizer inputs.</p><span>Best practice: keep a simple field record</span></article></div></section>
      <section className="cropGuide section" id="crops"><div className="sectionTitle"><p className="eyebrow">Crop guide</p><h2>Daily care, one crop at a time.</h2></div><div className="cropLayout"><div className="cropTabs">{crops.map((crop) => <button key={crop.name} className={selectedCrop.name === crop.name ? "cropActive" : ""} onClick={() => setSelectedCrop(crop)}><span>{crop.icon}</span>{crop.name}</button>)}</div><article className="cropDetail"><span className="bigCrop">{selectedCrop.icon}</span><div><p className="resultTag">{selectedCrop.name} basics</p><h3>Small checks prevent big problems.</h3><p>{selectedCrop.tip}</p><div className="checklist"><span>✓ Observe leaves twice a week</span><span>✓ Water only when soil needs it</span><span>✓ Keep a note of changes</span></div></div></article></div></section>
      <section className="help"><div><p className="eyebrow">When to ask locally</p><h2>Some crop problems need a field expert.</h2><p>If symptoms spread fast, affect many plants, or return after basic care, show photos and a plant sample to your nearest agriculture office or KVK.</p></div><span className="helpIcon">☏</span></section>
      <footer><a className="brand" href="#top"><span>🌱</span> Krishi Sathi</a><p>Built for the Plant Care and Soil Protection Community Engagement Project.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
