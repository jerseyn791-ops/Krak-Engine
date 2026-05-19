require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// 1. Gestion du favicon (MIME Type)
app.use((req, res, next) => {
    if (req.url.endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
    }
    next();
});

app.use(express.static(__dirname));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Cache simple pour éviter le 429 (TTL de 60 secondes)
let cache = { data: null, timestamp: 0 };

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/auto-analyse', async (req, res) => {
    // Vérification du cache
    if (Date.now() - cache.timestamp < 60000 && cache.data) {
        return res.json({ success: true, ...cache.data });
    }

    try {
        const { promptSysteme } = req.body;
        let fluxTerminalSimule = "";
        const sports = ['football', 'basketball', 'tennis', 'ice-hockey'];
        
        for (const sportSlug of sports) {
            // Limite à 5 événements max pour rester sous le radar 429
            const eventsResponse = await oddsApi.get('/events', { 
                params: { sport: sportSlug, status: 'pending', limit: 5 } 
            });
            
            for (const event of (eventsResponse.data || [])) {
                const oddsResponse = await oddsApi.get('/odds', { 
                    params: { eventId: String(event.id), bookmakers: '1xbet' } 
                });
                
                await sleep(600); // Pause anti-429
                // ... (reste de ton traitement des données)
            }
            await sleep(1000);
        }

        const result = await model.generateContent(promptSysteme + "\nFlux :\n" + fluxTerminalSimule);
        const responseData = { text: result.response.text(), logs: fluxTerminalSimule };
        
        cache = { data: responseData, timestamp: Date.now() };
        res.json({ success: true, ...responseData });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));