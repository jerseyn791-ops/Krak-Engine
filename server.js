require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// Configuration API Odds (Version v4)
const oddsApi = axios.create({
    baseURL: 'https://api.the-odds-api.com/v4',
    params: { apiKey: process.env.ODDS_API_KEY }
});

// Configuration Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.use(express.static(__dirname));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/auto-analyse', async (req, res) => {
    try {
        const { promptSysteme } = req.body;
        let fluxTerminalSimule = "";
        const sports = ['soccer_france_ligue_1', 'basketball_nba', 'tennis_atp_wimbledon'];

        for (const sport of sports) {
            try {
                const response = await oddsApi.get(`/sports/${sport}/odds`, {
                    params: { regions: 'eu', markets: 'h2h', oddsFormat: 'decimal' }
                });
                
                // On prend les 2 premiers matchs pour éviter le 429
                response.data.slice(0, 2).forEach(match => {
                    fluxTerminalSimule += `Match: ${match.home_team} vs ${match.away_team} | Cote: ${match.bookmakers[0]?.markets[0]?.outcomes[0]?.price}\n`;
                });
                await sleep(1000);
            } catch (e) { console.error(`Erreur ${sport}: ${e.message}`); }
        }

        const result = await model.generateContent(promptSysteme + "\nDonnées:\n" + fluxTerminalSimule);
        res.json({ success: true, text: result.response.text(), logs: fluxTerminalSimule });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));