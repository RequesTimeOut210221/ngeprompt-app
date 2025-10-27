// --- DOM Elements ---
const micButton = document.getElementById('mic-button');
const statusDiv = document.getElementById('status');
const bottomSheet = document.getElementById('bottom-sheet');
const selectionsView = document.getElementById('selections-view');
const resultsView = document.getElementById('results-view');
const rawTranscriptArea = document.getElementById('raw-transcript');
const structuredPromptArea = document.getElementById('structured-prompt');
const targetSelect = document.getElementById('prompt-target');
const frameworkSelect = document.getElementById('prompt-framework');
const copyButton = document.getElementById('copy-button');
const restartButton = document.getElementById('restart-button');
const loadingIndicator = document.getElementById('loading-indicator');
const jsonToggle = document.getElementById('json-toggle');
// const waveCanvas = document.getElementById('wave-canvas'); // DIHAPUS
// const canvasCtx = waveCanvas.getContext('2d'); // DIHAPUS
const actionButtons = document.getElementById('action-buttons');
        
// --- Data & Mappings ---
const allFrameworks = {
    simple: { text: 'Saran Otomatis' }, 
    rtf: { text: 'RTF (Role, Task, Format)' }, 
    persona: { text: 'Persona / Role-Play' },
    crispe: { text: 'CRISPE Framework' }, 
    cot: { text: 'Chain of Thought (CoT)' }, 
    ape: { text: 'APE (Action, Purpose, Expectation)' },
    race: { text: 'RACE (Role, Action, Context, Expectation)' }
};
const targetFrameworkMappings = {
    'image': ['simple', 'crispe', 'persona'], 
    'illustration': ['simple', 'crispe', 'persona'], 
    'photo': ['simple', 'crispe', 'persona', 'rtf'],
    'product-photo': ['simple', 'crispe', 'rtf'], 
    'animation': ['simple', 'crispe', 'rtf', 'ape'], 
    'document': ['simple', 'rtf', 'persona', 'crispe', 'cot', 'ape', 'race'],
    'paper': ['cot', 'race', 'ape', 'rtf', 'simple'], 
    'code': ['simple', 'rtf', 'ape'], 
    'simple-analysis': ['cot', 'ape', 'simple'],
    'complex-analysis': ['cot', 'crispe', 'race', 'ape', 'simple']
};

// --- State ---
let isRecording = false;
let finalTranscript = '';
let recognitionError = null;
let isJsonOutput = false;
let originalTextPrompt = '';
// let audioContext, analyser, source, dataArray, animationFrameId; // DIHAPUS
let debounceTimer;
// SOLUSI: Penanda untuk membedakan penghentian oleh pengguna vs otomatis
// let userStoppedRecording = false; // DIHAPUS - Tidak lagi diperlukan dengan continuous=false

// --- Speech Recognition Setup ---
// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; // DIHAPUS DARI SINI
let recognition;
// --- Perubahan di Setup ---
// (Setup akan dipindahkan ke DOMContentLoaded setelah pengecekan)

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Panggil checkBrowserSupport()
    const SpeechRecognition = checkBrowserSupport();

    // Jika browser tidak didukung, SpeechRecognition akan null, hentikan setup.
    if (!SpeechRecognition) return; 

    // Jika didukung, LANJUTKAN setup recognition
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'id-ID';

    // Setup event handlers untuk recognition
    recognition.onresult = (event) => {
        // Karena continuous=false, kita hanya akan dapat SATU hasil akhir
        const transcript = event.results[0][0].transcript;
        finalTranscript = transcript.trim();
        rawTranscriptArea.value = finalTranscript;
    };
    
    recognition.onend = () => {
        isRecording = false;
        
        // `finalTranscript` sudah di-set di `onresult`
        
        if (finalTranscript.trim() && !recognitionError) {
            showBottomSheet('results');
            // getEnhancedPrompt(finalTranscript); // DIHAPUS
            fetchGeneratedPrompt(); // PANGGIL FUNGSI BARU
        } else if (recognitionError) {
            // Biarkan pesan error tampil
        } else {
            // Tidak ada transkrip & tidak ada error (misal, berhenti tanpa bicara)
            hideBottomSheet();
            statusDiv.textContent = 'Klik untuk membuat prompt';
        }
    };

    recognition.onstart = () => {
        recognitionError = null;
        isRecording = true;
        statusDiv.textContent = 'Mendengarkan...';
        micButton.classList.remove('idle-animation', 'text-blue-500');
        micButton.classList.add('bg-red-500', 'text-white');
        micButton.querySelector('#mic-icon').classList.add('scale-110');
        showBottomSheet('selections');
    };

    recognition.onerror = (event) => {
        // Mengubah console.error menjadi console.log agar tidak terlihat menakutkan
        console.log('Speech recognition event:', event.error);
        recognitionError = event.error;
        if (event.error === 'no-speech') {
            statusDiv.textContent = 'Tidak ada suara terdeteksi. Silakan coba lagi.';
        } else {
            statusDiv.textContent = 'Error: ' + event.error;
        }
    };
    
    // Lanjutkan setup event listener lainnya
    populateFrameworks();
    micButton.addEventListener('click', toggleRecording);
    targetSelect.addEventListener('change', handleTargetChange);
    frameworkSelect.addEventListener('change', handleFrameworkChange);
    copyButton.addEventListener('click', copyToClipboard);
    rawTranscriptArea.addEventListener('input', handleTranscriptEdit);
    restartButton.addEventListener('click', restartProcess);
    jsonToggle.addEventListener('change', handleJsonToggle);
});

// --- UI Functions ---
function showBottomSheet(view = 'selections') {
    bottomSheet.classList.remove('translate-y-full');
    selectionsView.classList.toggle('hidden', view === 'results');
    resultsView.classList.toggle('hidden', view !== 'results');
    actionButtons.classList.toggle('hidden', view !== 'results');
}
function hideBottomSheet() { bottomSheet.classList.add('translate-y-full'); }
function populateFrameworks() {
    const selectedTarget = targetSelect.value;
    const optimalFrameworks = targetFrameworkMappings[selectedTarget] || Object.keys(allFrameworks);
    frameworkSelect.innerHTML = '';
    optimalFrameworks.forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = allFrameworks[key].text;
        frameworkSelect.appendChild(option);
    });
}

// --- Core Logic ---
async function toggleRecording() {
    if (isRecording) {
        // SOLUSI: Tandai bahwa pengguna yang menghentikan rekaman
        // userStoppedRecording = true; // DIHAPUS
        recognition.stop();
    } else {
        try {
            // SOLUSI: Reset penanda untuk sesi baru
            // userStoppedRecording = false; // DIHAPUS
            finalTranscript = '';
            originalTextPrompt = '';
            recognitionError = null; // Reset error state
            rawTranscriptArea.value = '';
            structuredPromptArea.value = '';
            // await setupAudioVisualization(); // DIHAPUS
            recognition.start();
        } catch (err) {
            console.error("Error starting microphone:", err);
            statusDiv.textContent = "Gagal mengakses mikrofon.";
        }
    }
}

// --- (Handler recognition.on... yang lama dipindahkan ke DOMContentLoaded) ---

// --- Audio Visualization --- (SEMUA FUNGSI DI BAWAH INI DIHAPUS)
/*
async function setupAudioVisualization() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (err) {
        console.error("Error accessing media devices.", err);
        statusDiv.textContent = "Izin mikrofon ditolak.";
        throw err; // Lemparkan error agar toggleRecording bisa menangkapnya
    }
}

function stopAudioVisualization() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    startIdleAnimation(); // Kembalikan ke animasi idle
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(console.error);
    }
}


let idleTime = 0;
function startIdleAnimation() {
    if (animationFrameId && isRecording) cancelAnimationFrame(animationFrameId); // Hentikan animasi sebelumnya jika ada
    
    waveCanvas.width = window.innerWidth;
    waveCanvas.height = window.innerHeight;
    
    function animateIdle() {
        if (isRecording) return; // Jangan jalankan jika sedang merekam
        canvasCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
        idleTime += 0.005;

        const centerX = waveCanvas.width / 2;
        const centerY = waveCanvas.height / 2;

        for (let i = 0; i < 3; i++) {
            const radius = 100 + i * 50;
            const angle = idleTime * (1 + i * 0.2);
            const alpha = 0.05 + Math.sin(idleTime * (1 + i * 0.3)) * 0.05;

            const gradient = canvasCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2);
            gradient.addColorStop(0, `rgba(0, 122, 255, ${alpha})`);
            gradient.addColorStop(1, `rgba(0, 122, 255, 0)`);
            
            canvasCtx.fillStyle = gradient;
            
            canvasCtx.beginPath();
            canvasCtx.moveTo(centerX + radius, centerY);
            for (let j = 0; j < Math.PI * 2; j += 0.1) {
                const r = radius + Math.sin(j * 4 + angle) * 20 + Math.sin(j * 2 + idleTime) * 10;
                canvasCtx.lineTo(centerX + r * Math.cos(j), centerY + r * Math.sin(j));
            }
            canvasCtx.closePath();
            canvasCtx.fill();
        }
        animationFrameId = requestAnimationFrame(animateIdle);
    }
    animateIdle();
}

function drawVoiceWave() {
    if (!isRecording) return;
    animationFrameId = requestAnimationFrame(drawVoiceWave);
    
    if (!analyser) return; // Tambahkan penjagaan jika analyser belum siap
    analyser.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = 'rgba(0, 122, 255, 0.4)';
    canvasCtx.beginPath();
    
    const sliceWidth = waveCanvas.width * 1.0 / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * waveCanvas.height / 3 + waveCanvas.height / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
    }
    
    canvasCtx.lineTo(waveCanvas.width, waveCanvas.height / 2);
    canvasCtx.stroke();
}
*/

// --- Other Functions ---
function restartProcess() {
    if (!isRecording) {
        // Reset tampilan dan state sebelum memulai rekaman baru
        hideBottomSheet();
        statusDiv.textContent = 'Klik untuk membuat prompt';
        finalTranscript = '';
        originalTextPrompt = '';
        rawTranscriptArea.value = '';
        structuredPromptArea.value = '';
        jsonToggle.checked = false;
        isJsonOutput = false;
        // Langsung mulai rekaman baru
        toggleRecording();
    }
}

function handleTranscriptEdit() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        // finalTranscript = rawTranscriptArea.value; // DIHAPUS (Redundan)
        // if (finalTranscript.trim()) { // DIHAPUS (Redundan)
        //    getEnhancedPrompt(finalTranscript); // DIHAPUS
        // }
        fetchGeneratedPrompt(); // PANGGIL FUNGSI BARU
    }, 500);
}
        
function handleTargetChange() {
    populateFrameworks();
    // if (finalTranscript.trim()) getEnhancedPrompt(finalTranscript); // DIHAPUS
    
    // PANGGIL FUNGSI BARU jika ada teks
    if (rawTranscriptArea.value.trim()) {
        fetchGeneratedPrompt();
    }
}
function handleFrameworkChange() {
    // if (finalTranscript.trim()) getEnhancedPrompt(finalTranscript); // DIHAPUS
    
    // PANGGIL FUNGSI BARU jika ada teks
    if (rawTranscriptArea.value.trim()) {
        fetchGeneratedPrompt();
    }
}

function handleJsonToggle() {
    isJsonOutput = jsonToggle.checked;
    
    // --- LOGIKA LAMA DIHAPUS ---
    // if (originalTextPrompt.trim()) {
    //    if (isJsonOutput) {
    //        convertPromptToJson(originalTextPrompt);
    //    } else {
    //        structuredPromptArea.value = originalTextPrompt;
    //    }
    // }
    // --- AKHIR LOGIKA LAMA ---

    // --- LOGIKA BARU ---
    // Jika ada teks di input, selalu panggil API untuk format baru (JSON atau teks).
    if (rawTranscriptArea.value.trim()) {
        fetchGeneratedPrompt();
    } 
    // Optimasi: Jika toggle dimatikan (bukan JSON) dan kita PUNYA
    // cache teks asli, tampilkan saja tanpa panggil API.
    else if (!isJsonOutput && originalTextPrompt.trim()) {
        structuredPromptArea.value = originalTextPrompt;
    }
}

/* FUNGSI handleUnsupportedBrowser LAMA DIHAPUS
function handleUnsupportedBrowser() {
    statusDiv.textContent = "Browser tidak mendukung Web Speech API.";
    micButton.disabled = true;
}
*/

// --- FUNGSI BARU SESUAI PERMINTAAN ---
function checkBrowserSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        handleUnsupportedBrowser();
        return null; // Kembalikan null untuk menandakan kegagalan
    }
    return SpeechRecognition; // Kembalikan implementasi yang ditemukan
}

function handleUnsupportedBrowser() {
    statusDiv.textContent = "Browser tidak didukung. Silakan ketik manual.";
    
    // Nonaktifkan tombol mic
    micButton.disabled = true;
    micButton.classList.add('opacity-50', 'cursor-not-allowed');
    micButton.classList.remove('idle-animation');
    
    // Tampilkan panel dan beri tahu user untuk mengetik
    showBottomSheet('results');
    
    // Beri placeholder di textarea
    rawTranscriptArea.placeholder = "Browser Anda tidak mendukung rekam suara. Silakan KETIK permintaan Anda di sini, lalu pilih target/kerangka di atas.";
    
    // Sembunyikan tombol (karena belum ada input)
    actionButtons.classList.add('hidden');
}


async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            // Jangan retry jika error 4xx (client error), kecuali 429 (rate limit)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                throw new Error(`Kesalahan Klien API: ${response.status}`);
            }
            // Jika percobaan habis, lemparkan error
            if (i === retries - 1) {
                throw new Error(`Gagal setelah ${retries} percobaan. Status terakhir: ${response.status}`);
            }
            // Tunggu sebelum mencoba lagi
            await new Promise(res => setTimeout(res, delay * (i + 1))); // Simple exponential backoff
        
        } catch (error) {
             // Handle network error
             if (i === retries - 1) throw error; // Lemparkan error jika percobaan habis
             await new Promise(res => setTimeout(res, delay * (i + 1)));
        }
    }
}

/**
 * Mengambil prompt yang dihasilkan dari backend serverless.
 * Fungsi ini membaca state saat ini dari DOM dan memanggil endpoint /api/generate-prompt.
 */
async function fetchGeneratedPrompt() {
    // 1. Membaca nilai dari DOM
    const rawText = rawTranscriptArea.value.trim();
    
    // Validasi: Jangan panggil API jika input kosong
    if (!rawText) {
        return; // Hentikan eksekusi jika tidak ada teks
    }
    
    const target = targetSelect.options[targetSelect.selectedIndex].text;
    const framework = frameworkSelect.options[frameworkSelect.selectedIndex].text;
    const isJsonOutput = jsonToggle.checked;

    // 2. Menampilkan loadingIndicator
    loadingIndicator.style.display = 'flex';
    structuredPromptArea.value = ''; // Bersihkan area hasil

    // 5. Menggunakan try...catch untuk menangani error
    try {
        // 3. Melakukan fetch ke endpoint kita sendiri (/api/generate-prompt)
        const response = await fetch('/api/generate-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // 4. Mengirim body JSON
            body: JSON.stringify({
                rawText: rawText,
                target: target,
                framework: framework,
                convertToJson: isJsonOutput,
            }),
        });

        // Menangani error HTTP
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Gagal mem-parsing respons error' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        // Menangani error HTTP
        if (!response.ok) {
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        // (Logika untuk menangani respons 'result' akan ditambahkan di prompt berikutnya)
        // const result = await response.json();
        // console.log("Respons diterima dari backend:", result); // Placeholder for debugging

        // --- AWAL PERUBAHAN (PROMPT 4.2) ---
        const result = await response.json();

        // Cek jika backend mengirim error di body (misal: validasi gagal)
        if (result.error) {
            throw new Error(result.error);
        }

        // Tampilkan hasil di textarea
        structuredPromptArea.value = result.generatedText;

        // Simpan hasil teks asli JIKA isJsonOutput adalah false.
        // Ini akan digunakan jika pengguna mengaktifkan toggle JSON nanti.
        if (!isJsonOutput) {
            originalTextPrompt = result.generatedText;
        } else {
            // Jika kita meminta JSON, kita tidak memiliki versi teks biasa,
            // jadi kita reset.
            originalTextPrompt = '';
        }
        // --- AKHIR PERUBAHAN (PROMPT 4.2) ---

    } catch (error) {
        console.error("Error fetching from API endpoint:", error);
        structuredPromptArea.value = `Maaf, terjadi kesalahan saat mengambil data.\n\nError: ${error.message}`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}


function copyToClipboard() {
    if (!structuredPromptArea.value) return;
    try {
        structuredPromptArea.select();
        structuredPromptArea.setSelectionRange(0, 99999); // Untuk mobile
        document.execCommand('copy');
        copyButton.textContent = 'Disalin!';
        setTimeout(() => { copyButton.textContent = 'Salin Prompt'; }, 2000);
        window.getSelection().removeAllRanges(); // Hapus seleksi setelah disalin
    } catch (err) {
         console.error('Gagal menyalin teks: ', err);
         // Di sini kita bisa menambahkan UI feedback jika gagal
         copyButton.textContent = 'Gagal!';
         copyButton.style.backgroundColor = '#EF4444'; // Merah
         setTimeout(() => { 
             copyButton.textContent = 'Salin Prompt';
             copyButton.style.backgroundColor = ''; // Kembali ke default
         }, 2000);
    }
}


async function copyToClipboard() { // Make function async
    const textToCopy = structuredPromptArea.value;
    if (!textToCopy) return;

    // Reset style jika sebelumnya gagal
    copyButton.textContent = 'Salin Prompt';
    copyButton.style.backgroundColor = ''; 
    
    try {
        // --- AWAL PERUBAHAN (PROMPT 5.1) ---
        // Ganti metode execCommand dengan Clipboard API modern
        await navigator.clipboard.writeText(textToCopy);
        // --- AKHIR PERUBAHAN (PROMPT 5.1) ---

        copyButton.textContent = 'Disalin!';
        setTimeout(() => { copyButton.textContent = 'Salin Prompt'; }, 2000);

        // .select(), .setSelectionRange(), dan .removeAllRanges() 
        // tidak lagi diperlukan untuk API clipboard modern.

    } catch (err) {
         console.error('Gagal menyalin teks: ', err);
         // Feedback error UI tetap dipertahankan
         copyButton.textContent = 'Gagal!';
         copyButton.style.backgroundColor = '#EF4444'; // Merah
         setTimeout(() => { 
             copyButton.textContent = 'Salin Prompt';
             copyButton.style.backgroundColor = ''; // Kembali ke default
         }, 2000);
    }
}
