// Menggunakan sintaks CommonJS (require) untuk kompatibilitas serverless (Vercel/Netlify)
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inisialisasi API Key dari environment variables
const apiKey = process.env.GEMINI_API_KEY;

// Handler utama untuk serverless function
module.exports = async (request, response) => {
    // 1. Validasi Metode Request: Hanya izinkan POST
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
    }

    // 2. Validasi API Key di Server
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        return response.status(500).json({ error: "Server configuration error." });
    }

    // 3. Validasi Input Body
    const { rawText, target, framework, convertToJson } = request.body;

    if (!rawText || !target || !framework || convertToJson === undefined) {
        return response.status(400).json({ 
            error: "Bad Request: Missing required fields.",
            details: {
                rawText: !!rawText,
                target: !!target,
                framework: !!framework,
                convertToJson: convertToJson !== undefined
            }
        });
    }

    try {
        // --- Logika Meta-Prompt Dinamis ---
        let systemInstruction, userPrompt;
        let generationConfig = {}; // Default

        if (convertToJson === true) {
            // Jika `true`, minta model untuk menjadi Ahli Prompt + Konverter JSON
            generationConfig = { responseMimeType: "application/json" };
            
            systemInstruction = `Anda adalah asisten ahli dalam rekayasa prompt DAN utilitas konversi JSON.
Tugas Anda adalah:
1. Mengambil transkrip mentah, tujuan, dan kerangka dari pengguna.
2. Menyempurnakan transkrip tersebut menjadi prompt yang efektif, jelas, dan terstruktur (sama seperti tugas non-JSON).
3. Mengonversi prompt yang SUDAH ANDA SEMPURNAKAN (bukan transkrip mentah) menjadi objek JSON yang logis.
4. Kunci (keys) JSON harus dalam format camelCase (bahasa Inggris), dan nilai (values) tetap dalam bahasa asli (Indonesia).
5. Output akhir Anda HARUS HANYA berupa string JSON yang valid, tanpa penjelasan atau format markdown.`;
            
            userPrompt = `KONTEKS PENTING:
- Tujuan Akhir Prompt: "${target}"
- Kerangka yang Diminta: "${framework}"
- Transkrip mentah: "${rawText}"

HASILKAN PROMPT YANG DISEMPURNAKAN SEBAGAI JSON SEKARANG.`;

        } else {
            // Jika `false`, minta model untuk menjadi Ahli Prompt saja
            systemInstruction = `Anda adalah asisten ahli dalam rekayasa prompt. Tugas Anda adalah mengambil transkrip mentah dari permintaan pengguna dan mengubahnya menjadi prompt yang terstruktur, jelas, dan efektif untuk model AI. 
Instruksi: 
1. Analisis permintaan pengguna dalam transkrip. 
2. Sesuaikan detail dan istilah teknis agar relevan dengan tujuan akhir yang diberikan. 
3. Jika permintaan kurang detail, tambahkan informasi yang relevan secara logis untuk memperkaya prompt. 
4. Format output akhir sesuai dengan kerangka prompt yang diminta. 
5. Ganti placeholder generik (misal: [Sebutkan peran]) dengan saran yang konkret dan relevan berdasarkan konteks. 
6. Pastikan output akhir HANYA berisi teks prompt yang sudah jadi, tanpa ada judul, pembuka, penutup, atau penjelasan tambahan dari Anda.`;

            userPrompt = `KONTEKS PENTING:
- Tujuan Akhir Prompt: Menghasilkan sebuah "${target}".
- Kerangka yang Diminta: "${framework}".
- Transkrip mentah dari pengguna: "${rawText}"

HASILKAN PROMPT SEKARANG.`;
        }
        
        // --- Eksekusi API Call ---

        // Inisialisasi Google Generative AI SDK
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            generationConfig 
        });

        // Hapus logika 2 langkah sebelumnya, ganti dengan 1 panggilan dinamis
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
        });

        const generatedText = result.response.text().trim();

        // 5. Kembalikan hasil (teks biasa atau string JSON)
        return response.status(200).json({
            generatedText: generatedText
        });

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Memberikan pesan error yang lebih informatif jika ada
        const errorMessage = error.message || "An unknown error occurred.";
        return response.status(500).json({ error: "Failed to generate prompt on the server.", details: errorMessage });
    }
};

// Catatan: Pastikan untuk mengatur variabel lingkungan GEMINI_API_KEY di platform serverless Anda (Vercel, Netlify, dll.) sebelum menjalankan kode ini.