require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.ODDS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const oddsApi = axios.create({
    baseURL: 'https://api.odds-api.io/v3',
    params: { apiKey: API_KEY }
});

// Initialisation correcte de Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const TARGET_MARKETS = {
    football: ['ML', 'Totals', 'Team Total Home', 'Team Total Away', 'Double Chance'],
    basketball: ['ML', 'Totals', 'Team Total Home', 'Team Total Away'],
    tennis: ['ML', 'Spread (Games)', 'Totals (Games)'],
    'ice-hockey': ['ML', 'Totals', '3-Way Result']
};

function formatAllOddsDisplay(marketName, oddsArray) {
    if (!oddsArray || oddsArray.length === 0) return ['N/A'];
    return oddsArray.map(oddsObj => {
        const hdpStr = oddsObj.hdp !== undefined ? `[Hdp: ${oddsObj.hdp}] ` : '';
        switch (marketName) {
            case 'ML': case '3-Way Result':
                return `${hdpStr}Home: ${oddsObj.home || 'N/A'} | Away: ${oddsObj.away || 'N/A'}`;
            case 'Double Chance':
                return `1X: ${oddsObj['1X'] || 'N/A'} | X2: ${oddsObj['X2'] || 'N/A'}`;
            case 'Totals': case 'Team Total Home': case 'Team Total Away':
                return `${hdpStr}Over: ${oddsObj.over || 'N/A'} | Under: ${oddsObj.under || 'N/A'}`;
            default: return JSON.stringify(oddsObj);
        }
    });
}

app.post('/api/auto-analyse', async (req, res) => {
    try {
        const { promptSysteme } = req.body;
        let fluxTerminalSimule = "";
        const sports = ['football', 'basketball', 'tennis', 'ice-hockey'];
        const limiteDeuxHeures = Date.now() + (2 * 60 * 60 * 1000);

        for (const sportSlug of sports) {
            try {
                const eventsResponse = await oddsApi.get('/events', { params: { sport: sportSlug, status: 'pending', limit: 20 } });
                for (const event of (eventsResponse.data || [])) {
                    if (new Date(event.date).getTime() > limiteDeuxHeures) continue;

                    const oddsResponse = await oddsApi.get('/odds', { params: { eventId: String(event.id), bookmakers: '1xbet' } });
                    const matchData = oddsResponse.data;
                    const bookmaker = matchData?.bookmakers?.['1xbet'];
                    
                    if (bookmaker) {
                        fluxTerminalSimule += `\n📊 ${event.home} vs ${event.away} | 🏆 ${event.league || 'Ligue'}\n`;
                        bookmaker.filter(m => TARGET_MARKETS[sportSlug]?.includes(m.name)).forEach(m => {
                            const lines = formatAllOddsDisplay(m.name, m.odds);
                            fluxTerminalSimule += ` ▪️ ${m.name}: ${lines[0]}\n`;
                        });
                    }
                }
            } catch(e) { console.error(`Erreur ${sportSlug}:`, e.message); }
        }

        const result = await model.generateContent(promptSysteme + "\nFlux de données :\n" + fluxTerminalSimule);
        res.json({ success: true, text: result.response.text(), logs: fluxTerminalSimule });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur port ${PORT}`));