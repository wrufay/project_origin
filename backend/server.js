const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// No auth on these routes yet, so rate limit by IP to bound the AI/API bill.
// General cap on all API traffic, plus a tighter cap on the routes that call
// out to Claude (the one that actually costs money per request).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to this endpoint, please try again later.' },
});

app.use('/api/', apiLimiter);

// Local SQLite database for spaced repetition - no server or account needed,
// just a file next to this script. Created automatically on first run.
const db = new Database(path.join(__dirname, 'data.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  english TEXT NOT NULL,
  translation TEXT,
  pronunciation TEXT,
  culturalContext TEXT,
  timesSeenCount INTEGER NOT NULL DEFAULT 1,
  lastSeen TEXT NOT NULL,
  nextReview TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(userId, english)
)`);
console.log('Using local SQLite database at', path.join(__dirname, 'data.sqlite'));

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Hardcoded cultural content for our 3 target items
const CULTURAL_ITEMS = {
  'zongzi': {
    english: 'Zongzi',
    translation: '粽子',
    pronunciation: 'zòngzi',
    culturalContext: 'Sticky rice wrapped in bamboo leaves, eaten during Dragon Boat Festival to honor Qu Yuan, a poet who drowned himself in protest. Families wrap them together — each region has its own filling style. The act of wrapping zongzi connects you to thousands of years of tradition.'
  },
  'star anise': {
    english: 'Star Anise',
    translation: '八角',
    pronunciation: 'bājiǎo',
    culturalContext: 'The "eight corners" spice is essential in Chinese five-spice powder and braised dishes. Its star shape represents luck and completeness. This is the smell of red-braised pork belly, of your grandmother\'s kitchen, of home.'
  },
  'mooncake': {
    english: 'Mooncake',
    translation: '月饼',
    pronunciation: 'yuèbǐng',
    culturalContext: 'Shared during Mid-Autumn Festival when families gather to admire the full moon. The round shape symbolizes completeness and reunion. Inside, sweet lotus paste or red bean — each bite a wish for family togetherness, even when far apart.'
  }
};

// Helper to match detected object to our items
function matchCulturalItem(detected) {
  const lower = detected.toLowerCase();

  // Check for matches (including partial matches)
  if (lower.includes('zongzi') || lower.includes('rice dumpling') || lower.includes('sticky rice')) {
    return CULTURAL_ITEMS['zongzi'];
  }
  if (lower.includes('star anise') || lower.includes('anise') || lower.includes('八角')) {
    return CULTURAL_ITEMS['star anise'];
  }
  if (lower.includes('mooncake') || lower.includes('moon cake') || lower.includes('月饼')) {
    return CULTURAL_ITEMS['mooncake'];
  }

  return null;
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'ProjectOrigin API is running' });
});

// Main scan endpoint - using Claude for everything
app.post('/api/scan', aiLimiter, async (req, res) => {
  try {
    const { image, userId = 'default', familiarityLevel = 0, proficiencyLevel = null, learningGoal = null } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Use Claude to detect objects and generate cultural/historical context
    console.log('Starting Claude detection...');

    const proficiencyInstruction = proficiencyLevel
      ? `\n\nLEARNER PROFICIENCY: ${proficiencyLevel.replace(/_/g, ' ')}\nAdjust the complexity of your explanation and vocabulary in the culturalContext field accordingly - keep sentences simple and avoid jargon for beginners, and use more nuanced framing for intermediate, advanced, or fluent learners.`
      : '';

    const goalInstruction = learningGoal
      ? `\n\nLEARNER GOAL: ${learningGoal.replace(/_/g, ' ')}\nLean the cultural context toward what's most useful for this goal - practical/navigational framing for travel, professional framing for business, casual social framing for conversation, character/etymology notes for reading and writing, and historical/traditional depth for culture and traditions.`
      : '';

    let claudeResult;
    try {
      claudeResult = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image,
                },
              },
              {
                type: 'text',
                text: `You are a knowledgeable cultural expert. Examine this image and identify the most prominent or interesting object, food, symbol, or item visible.

MANDARIN IMMERSION LEVEL: ${familiarityLevel}/10
Adjust the culturalContext field based on this familiarity level. The user is learning Mandarin and this controls how much Chinese vocabulary appears in the description:

- Level 0: Write entirely in English, no Chinese characters at all. Example: "Mooncakes are traditional pastries eaten during the Mid-Autumn Festival. Families gather to appreciate the full moon while sharing these treats. The round shape symbolizes reunion and togetherness."

- Level 1: Write entirely in English, no Chinese characters at all. Example: "Mooncakes are traditional pastries eaten during the Mid-Autumn Festival. Families gather to appreciate the full moon while sharing these treats. The round shape symbolizes reunion and togetherness."

- Level 2: Write entirely in English, no Chinese characters at all. Example: "Mooncakes are traditional pastries eaten during the Mid-Autumn Festival. Families gather to appreciate the full moon while sharing these treats. The round shape symbolizes reunion and togetherness."

- Level 3: Include only the main term in Chinese with pinyin. Example: "月饼 (yuèbǐng) are traditional pastries eaten during the Mid-Autumn Festival. Families gather to appreciate the full moon while sharing these treats. The round shape symbolizes reunion and togetherness."

- Level 4: Include only the main term in Chinese with pinyin. Example: "月饼 (yuèbǐng) are traditional pastries eaten during the Mid-Autumn Festival. Families gather to appreciate the full moon while sharing these treats. The round shape symbolizes reunion and togetherness."

- Level 5: Include the main term plus one related cultural term. Example: "月饼 (yuèbǐng) are traditional pastries eaten during 中秋节 (Zhōngqiū Jié) - the Mid-Autumn Festival. Families gather to appreciate the full moon while sharing these treats. The round shape symbolizes reunion and togetherness."

- Level 6: Include 2-3 Chinese terms with pinyin. Example: "月饼 (yuèbǐng) are traditional pastries eaten during 中秋节 (Zhōngqiū Jié) - the Mid-Autumn Festival. Families gather to appreciate the 满月 (mǎnyuè - full moon) while sharing these treats. The round shape symbolizes reunion and togetherness."

- Level 7: Use more Chinese vocabulary throughout. Example: "月饼 (yuèbǐng) are traditional pastries eaten during 中秋节 (Zhōngqiū Jié) - the Mid-Autumn Festival. Families gather to appreciate the 满月 (mǎnyuè - full moon) while sharing these treats. The round shape symbolizes 团圆 (tuányuán - reunion and togetherness)."

- Level 8: Heavy Chinese vocabulary with pinyin. Example: "月饼 (yuèbǐng) are traditional pastries eaten during 中秋节 (Zhōngqiū Jié). 家人 (jiārén - family members) gather to appreciate the 满月 (mǎnyuè - full moon) while sharing these treats. The round shape symbolizes 团圆 (tuányuán - reunion)."

- Level 9: Mixed Chinese-English immersive style. Example: "月饼 are traditional pastries eaten during 中秋节. 家人团聚 (jiārén tuánjù - families gather) to appreciate the 满月 while sharing these 美味的 (měiwèi de - delicious) treats. The round shape symbolizes 团圆."

- Level 10: Mostly Chinese with some English translation. Example: "月饼是中秋节的传统美食 (Yuèbǐng shì Zhōngqiū Jié de chuántǒng měishí). 家人团聚赏满月，分享月饼。圆形象征着团圆 (The round shape symbolizes reunion)."

IMPORTANT: The translation and pronunciation fields should ALWAYS contain Chinese characters and pinyin regardless of familiarityLevel. Only the culturalContext field changes based on the level.
${proficiencyInstruction}${goalInstruction}

IMPORTANT INSTRUCTIONS:
- ALWAYS provide Chinese translation (simplified characters) and pinyin pronunciation for ALL objects, regardless of cultural origin
- If the object has specific cultural significance (Chinese or otherwise), include that context
- CRITICAL: Keep culturalContext to 150-180 characters maximum (about 2-3 lines). Be concise but meaningful.

Examples:

Chinese cultural item:
{
  "english": "Mooncake",
  "translation": "月饼",
  "pronunciation": "yuèbǐng",
  "culturalContext": "Shared during Mid-Autumn Festival. The round shape symbolizes family reunion, filled with sweet lotus paste or red bean."
}

Japanese cultural item:
{
  "english": "Matcha",
  "translation": "抹茶",
  "pronunciation": "matcha",
  "culturalContext": "Green tea powder central to Japanese tea ceremonies. Each whisked bowl embodies mindfulness and finding beauty in imperfection."
}

Universal everyday object:
{
  "english": "Water Bottle",
  "translation": "水瓶",
  "pronunciation": "shuǐpíng",
  "culturalContext": "A simple vessel for life's essential element. From ancient clay pots to modern containers, carrying water is a universal human need."
}

Modern tech object:
{
  "english": "Smartphone",
  "translation": "智能手机",
  "pronunciation": "zhìnéng shǒujī",
  "culturalContext": "Revolutionized human connection in just over a decade, transforming from luxury to necessity and reshaping how we communicate."
}

Food with cultural significance:
{
  "english": "Croissant",
  "translation": "羊角面包",
  "pronunciation": "yángjiǎo miànbāo",
  "culturalContext": "Flaky pastry with Viennese origins, now a symbol of French breakfast culture. The crescent shape celebrates a 17th-century victory."
}

Respond with ONLY valid JSON in this format. If NO clear object is visible, respond with: {"error": "none"}

Be generous in identification and make the cultural context engaging and educational.`,
              },
            ],
          },
        ],
      });
      console.log('Claude call completed successfully');
    } catch (claudeError) {
      console.error('Claude API Error:', claudeError.message);
      console.error('Full error:', claudeError);
      return res.status(500).json({
        error: 'Failed to call Claude API',
        details: claudeError.message
      });
    }

    let claudeText = (claudeResult.content.find(block => block.type === 'text')?.text || '').trim();
    console.log('Raw Claude response:', claudeText);

    // Remove markdown code blocks if present (```json ... ```)
    if (claudeText.startsWith('```')) {
      claudeText = claudeText.replace(/^```json?\n?/i, '').replace(/\n?```$/m, '').trim();
      console.log('After removing markdown:', claudeText);
    }

    // Parse Claude's JSON response
    let culturalData;
    try {
      culturalData = JSON.parse(claudeText);
      console.log('Parsed cultural data:', culturalData);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Failed to parse Claude response:', claudeText);
      console.error('Response length:', claudeText.length);
      console.error('First 200 chars:', claudeText.substring(0, 200));

      // Return a more helpful error
      return res.status(500).json({
        error: 'Failed to parse AI response',
        details: parseError.message,
        preview: claudeText.substring(0, 100)
      });
    }

    if (culturalData.error === 'none') {
      return res.status(404).json({
        error: 'Item not recognized',
        message: 'Point your camera at an object to learn about it!'
      });
    }

    // Build response data
    const data = {
      english: culturalData.english,
      translation: culturalData.translation,
      pronunciation: culturalData.pronunciation,
      culturalContext: culturalData.culturalContext
    };

    // Check if user has seen this word before (spaced repetition)
    const english = culturalData.english.toLowerCase();
    const existingWord = db.prepare('SELECT * FROM words WHERE userId = ? AND english = ?').get(userId, english);

    let isReview = false;
    if (existingWord) {
      // Update existing word
      const timesSeenCount = existingWord.timesSeenCount + 1;
      const nextReview = new Date(Date.now() + timesSeenCount * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`UPDATE words SET timesSeenCount = ?, lastSeen = ?, nextReview = ?, translation = ?, pronunciation = ?, culturalContext = ? WHERE id = ?`)
        .run(timesSeenCount, new Date().toISOString(), nextReview, data.translation, data.pronunciation, data.culturalContext, existingWord.id);
      isReview = true;
      data.timesSeenCount = timesSeenCount;
    } else {
      // Save new word
      const now = new Date().toISOString();
      db.prepare(`INSERT INTO words (userId, english, translation, pronunciation, culturalContext, timesSeenCount, lastSeen, nextReview, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`)
        .run(userId, english, data.translation, data.pronunciation, data.culturalContext, now, now, now);
      data.timesSeenCount = 1;
    }

    data.isReview = isReview;
    res.json(data);

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to process image', details: error.message });
  }
});

// Definition endpoint using Claude
app.post('/api/definition', aiLimiter, async (req, res) => {
  try {
    const { word } = req.body;

    if (!word) {
      return res.status(400).json({ error: 'No word provided' });
    }

    const result = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Give a concise, learner-friendly definition (1-2 sentences) of "${word}" as it's used in everyday English. Respond with plain text only, no markdown or JSON.`,
        },
      ],
    });

    const definition = (result.content.find(block => block.type === 'text')?.text || '').trim();

    res.json({ definition });
  } catch (error) {
    console.error('Definition error:', error);
    res.status(500).json({ error: 'Failed to fetch definition', details: error.message });
  }
});

// Get user's vocabulary
app.get('/api/vocabulary/:userId', async (req, res) => {
  try {
    const words = db.prepare('SELECT * FROM words WHERE userId = ? ORDER BY lastSeen DESC').all(req.params.userId);
    res.json(words);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vocabulary' });
  }
});

// Get words due for review
app.get('/api/review/:userId', async (req, res) => {
  try {
    const words = db.prepare('SELECT * FROM words WHERE userId = ? AND nextReview <= ? ORDER BY nextReview ASC')
      .all(req.params.userId, new Date().toISOString());
    res.json(words);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch review words' });
  }
});

// Record a review outcome for one word
app.post('/api/review/:userId/:wordId', (req, res) => {
  try {
    const { userId, wordId } = req.params;
    const { remembered } = req.body;

    const word = db.prepare('SELECT * FROM words WHERE id = ? AND userId = ?').get(wordId, userId);
    if (!word) {
      return res.status(404).json({ error: 'Word not found' });
    }

    let timesSeenCount;
    let nextReview;
    if (remembered) {
      timesSeenCount = word.timesSeenCount + 1;
      nextReview = new Date(Date.now() + timesSeenCount * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Didn't remember it - review again tomorrow, ease off the interval a bit
      timesSeenCount = Math.max(1, word.timesSeenCount - 1);
      nextReview = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    db.prepare('UPDATE words SET timesSeenCount = ?, lastSeen = ?, nextReview = ? WHERE id = ?')
      .run(timesSeenCount, new Date().toISOString(), nextReview, word.id);

    res.json({ id: word.id, timesSeenCount, nextReview });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record review' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
