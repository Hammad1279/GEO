import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAIClient() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required but not configured in the Settings > Secrets panel.');
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoint: Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Endpoint: Fetch dynamic placeholders
  app.get('/api/gemini/placeholders', async (req, res) => {
    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          role: 'user',
          parts: [{
            text: 'Generate 20 creative, short, diverse VIDEO OVERLAY GRAPHIC prompts that a video editor would drop on top of b-roll footage — the kind of on-screen text/graphic overlays seen in documentary and educational YouTube videos (e.g. "big stat callout for animal population number", "lower-third location tag for a hiking trail shot", "quote highlight caption over a forest canopy shot", "warning banner overlay for a danger-zone clip", "comparison tag overlay for two side-by-side species shots", "map pin location overlay"). These are overlay graphics that sit ON TOP of a background video/image, not full UI screens. Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.'
          }]
        }
      });
      res.json({ text: response.text || '[]' });
    } catch (err) {
      console.error('Error fetching placeholders:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // API Endpoint: Stream content generation
  app.post('/api/gemini/generate-stream', async (req, res) => {
    const { prompt, model, temperature } = req.body;
    try {
      const ai = getAIClient();
      const responseStream = await ai.models.generateContentStream({
        model: model || 'gemini-3.5-flash',
        contents: [{ parts: [{ text: prompt }], role: 'user' }],
        config: typeof temperature === 'number' ? { temperature } : undefined,
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      console.error('Error in stream generation:', err);
      // If headers aren't sent yet, we can send a 500 error
      if (!res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
      } else {
        // Otherwise, send an error event and close stream
        res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' })}\n\n`);
        res.end();
      }
    }
  });

  // Vite middleware for development or static server for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
