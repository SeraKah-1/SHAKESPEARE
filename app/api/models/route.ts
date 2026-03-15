import { NextResponse } from 'next/server';

// Simple in-memory cache
let cachedGroqModels: { provider: string; model_id: string }[] | null = null;
let groqCacheTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET() {
  try {
    const models: { provider: string; model_id: string }[] = [];

    // Fetch Groq Models
    const groqApiKey = process.env.GROQ_API_KEY;
    console.log('GROQ_API_KEY is:', groqApiKey ? 'Set' : 'Not Set');
    
    if (groqApiKey) {
      const now = Date.now();
      if (cachedGroqModels && (now - groqCacheTime < CACHE_TTL)) {
        models.push(...cachedGroqModels);
      } else {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
          });
          if (groqRes.ok) {
            const groqData = await groqRes.json();
            const fetchedGroqModels: { provider: string; model_id: string }[] = [];
            groqData.data.forEach((model: any) => {
              if (!model.id.toLowerCase().includes('whisper')) {
                fetchedGroqModels.push({ provider: 'groq', model_id: model.id });
              }
            });
            cachedGroqModels = fetchedGroqModels;
            groqCacheTime = now;
            models.push(...fetchedGroqModels);
          }
        } catch (e) {
          console.error('Error fetching Groq models:', e);
        }
      }
    }

    // Fetch Gemini Models
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    console.log('GEMINI_API_KEY is:', geminiApiKey ? 'Set' : 'Not Set');
    if (geminiApiKey) {
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
        console.log('Gemini API Response Status:', geminiRes.status);
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          geminiData.models.forEach((model: any) => {
            if (model.supportedGenerationMethods && model.supportedGenerationMethods.includes('generateContent')) {
              models.push({ provider: 'gemini', model_id: model.name.replace('models/', '') });
            }
          });
        } else {
          console.error('Gemini API Error:', await geminiRes.text());
        }
      } catch (e) {
        console.error('Error fetching Gemini models:', e);
      }
    }

    // Fallback models if API keys are not set or fetch fails
    if (models.length === 0) {
      models.push(
        { provider: 'gemini', model_id: 'gemini-3.1-pro-preview' },
        { provider: 'gemini', model_id: 'gemini-3-flash-preview' },
        { provider: 'gemini', model_id: 'gemini-2.5-flash' },
        { provider: 'groq', model_id: 'llama-3.3-70b-versatile' },
        { provider: 'groq', model_id: 'mixtral-8x7b-32768' }
      );
    }

    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
