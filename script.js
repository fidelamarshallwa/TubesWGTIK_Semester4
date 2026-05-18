// =====================
// AUDIO MODEL
// =====================

const URL_AUDIO =
  "https://teachablemachine.withgoogle.com/models/azF9Qfx9T/";

let modelPeople;
let modelAudio;
let stream;

let isRunning = false;

let peopleCount = 0;

let audioState =
  "Background Noise";

let lastState = "";

let audioCooldown = false;

const panel =
  document.getElementById("cam-panel");

const badge =
  document.getElementById("result-badge");

// CLOCK
setInterval(() => {

  const now =
    new Date();

  document.getElementById("clock").textContent =
    now.toLocaleTimeString("id-ID");

}, 1000);

// START SYSTEM
async function startSystem(){

  try{

    document.getElementById(
      "start-screen"
    ).style.display = "none";

    document.getElementById(
      "status-system"
    ).textContent =
      "Status: Memuat AI...";

    // LOAD MODEL
    modelPeople =
      await cocoSsd.load();

    // CAMERA + MICROPHONE
    const video =
      document.getElementById("webcam");

    stream =
      await navigator.mediaDevices.getUserMedia({
        video:true,
        audio:true
      });

    video.srcObject = stream;

    video.onloadedmetadata = async () => {

      const canvas =
        document.getElementById("overlay");

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      // AUDIO MODEL
      await loadAudioModel();

      isRunning = true;

      document.getElementById(
        "status-system"
      ).textContent =
        "Status: Sistem Aktif";

      detectFrame();
    };

  } catch(err){

    alert(
      "Izinkan akses kamera dan mikrofon."
    );

    console.log(err);
  }
}

// =====================
// AUDIO DETECTION
// =====================

async function loadAudioModel(){
  try {
    const checkpointURL = URL_AUDIO + "model.json";
    const metadataURL = URL_AUDIO + "metadata.json";

    modelAudio = speechCommands.create(
      "BROWSER_FFT", 
      null, 
      checkpointURL, 
      metadataURL
    );

    if (!modelAudio) {
      throw new Error("Objek modelAudio gagal dibuat oleh speechCommands.");
    }

    await modelAudio.ensureModelLoaded();

    modelAudio.listen((result) => {
      
      const labels = modelAudio.wordLabels();
      let highest = 0;
      let detectedClass = "";

      for(let i=0; i<labels.length; i++){
        const label = labels[i];
        const probability = result.scores[i];

        // BACKGROUND NOISE
        if(label === "Background Noise"){
          document.getElementById("noise-normal").textContent = (probability * 100).toFixed(1) + "%";
          document.getElementById("noise-normal-bar").style.width = (probability * 100) + "%";
        }

        // BERISIK
        if(label === "Berisik"){
          document.getElementById("noise-berisik").textContent = (probability * 100).toFixed(1) + "%";
          document.getElementById("noise-berisik-bar").style.width = (probability * 100) + "%";
        }

        if(probability > highest){
          highest = probability;
          detectedClass = label;
        }
      }

      audioState = detectedClass;
      updateSystemUI();

    }, {
      includeSpectrogram: true,
      probabilityThreshold: 0.70,
      overlapFactor: 0.5
    });

  } catch(error){
    console.error("Detail Error Audio:", error);
    alert("Model audio gagal dimuat. Cek Console untuk detailnya.");
  }
}

// =====================
// PEOPLE DETECTION
// =====================

async function detectFrame(){

  if(!isRunning) return;

  const video =
    document.getElementById("webcam");

  const predictions =
    await modelPeople.detect(video);

  const people =
    predictions.filter(
      p => p.class === "person"
    );

  peopleCount =
    people.length;

  document.getElementById(
    "people-count"
  ).textContent =
    peopleCount;

  drawBoxes(people);

  updateSystemUI();

  requestAnimationFrame(detectFrame);
}

// DRAW BOX
function drawBoxes(people){

  const canvas =
    document.getElementById("overlay");

  const ctx =
    canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  people.forEach(person => {

    const [x,y,w,h] =
      person.bbox;

    ctx.strokeStyle =
      peopleCount >= 4
      ? "#ff3c5a"
      : "#00ff9d";

    ctx.lineWidth = 3;

    ctx.strokeRect(
      x,y,w,h
    );

    ctx.fillStyle =
      peopleCount >= 4
      ? "#ff3c5a"
      : "#00ff9d";

    ctx.font =
      "bold 12px Arial";

    ctx.save();
    ctx.scale(-1, 1);
    
    ctx.fillText(
      "PENGUNJUNG",
      -(x + w),
      y > 15 ? y - 5 : 15
    );
    
    ctx.restore();

  });
}

// =====================
// UPDATE UI
// =====================

function updateSystemUI(){

  if(!isRunning) return;

  const roomStatus =
    document.getElementById("room-status");

  const warningAudio =
    document.getElementById("warning-audio");

  // ROOM FULL
  if(peopleCount >= 4){

    panel.style.borderColor =
      "#ff3c5a";

    badge.style.color =
      "#ff3c5a";

    badge.style.borderColor =
      "#ff3c5a";

    badge.innerHTML =
      `RUANGAN PENUH<br>${peopleCount}/4 ORANG`;

    roomStatus.innerHTML =
      `
        🔴 Kapasitas ruangan penuh.<br>
        Pengunjung tidak diperbolehkan masuk.
      `;

    addLog(
      "RUANGAN PENUH"
    );
  }

  // BERISIK
  else if(audioState === "Berisik"){

    panel.style.borderColor =
      "#ffb800";

    badge.style.color =
      "#ffb800";

    badge.style.borderColor =
      "#ffb800";

    badge.innerHTML =
      `HARAP TENANG`;

    roomStatus.innerHTML =
      `
        🟡 Terdeteksi suara berisik.<br>
        Mohon menjaga ketenangan perpustakaan.
      `;

    if(!audioCooldown){

      warningAudio.play();

      audioCooldown = true;

      setTimeout(() => {

        audioCooldown = false;

      }, 150);
    }

    addLog(
      "SUARA BERISIK"
    );
  }

  // SAFE
  else {

    panel.style.borderColor =
      "#00ff9d";

    badge.style.color =
      "#00ff9d";

    badge.style.borderColor =
      "#00ff9d";

    badge.innerHTML =
      `RUANGAN KONDUSIF`;

    roomStatus.innerHTML =
      `
        🟢 Kapasitas ruangan aman.<br>
        Suasana perpustakaan kondusif.
      `;

    addLog(
      "RUANGAN AMAN"
    );
  }
}

// =====================
// LOG
// =====================

function addLog(text){

  if(lastState === text) return;

  lastState = text;

  const log =
    document.getElementById("history-log");

  const div =
    document.createElement("div");

  div.className =
    "log-entry";

  div.innerHTML =
    `
      [${new Date().toLocaleTimeString("id-ID")}]
      ${text}
    `;

  log.prepend(div);

  if(log.children.length > 15){

    log.removeChild(
      log.lastChild
    );
  }
}

// =====================
// STOP SYSTEM
// =====================

function stopSystem(){

  isRunning = false;

  if(stream){

    stream.getTracks().forEach(
      track => track.stop()
    );
  }

  if(modelAudio){

    modelAudio.stopListening();
  }

  document.getElementById(
    "start-screen"
  ).style.display = "flex";

  document.getElementById(
    "status-system"
  ).textContent =
    "Status: Offline";

  badge.innerHTML =
    "SYSTEM STOPPED";
}