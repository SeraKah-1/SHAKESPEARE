import fs from 'fs/promises';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const configPath = path.join(process.cwd(), 'agent_config.json');

export class DynamicRouter {
  async getConfig() {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  }

  async generate(role: string, prompt: string): Promise<string> {
    const config = await this.getConfig();
    const roleConfig = config[role];

    if (!roleConfig) {
      throw new Error(`Role ${role} not found in config`);
    }

    const { primary, fallback } = roleConfig;
    const temperature = role === 'wordsmith' ? 0.75 : 0.3; // Wordsmith needs more creativity

    try {
      console.log(`[${role}] Trying primary model: ${primary.model_id} (${primary.provider})`);
      return await this.callModel(primary.provider, primary.model_id, prompt, temperature);
    } catch (error: any) {
      console.error(`[${role}] Primary model failed:`, error.message);
      
      // Check if it's a rate limit (429) or timeout
      if (error.message.includes('429') || error.message.includes('timeout') || error.status === 429) {
        console.log(`[${role}] Falling back to: ${fallback.model_id} (${fallback.provider})`);
        return await this.callWithRetry(fallback.provider, fallback.model_id, prompt, 3, temperature);
      }
      
      throw error;
    }
  }

  private async callWithRetry(provider: string, modelId: string, prompt: string, retries: number, temperature?: number): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.callModel(provider, modelId, prompt, temperature);
      } catch (error: any) {
        if (error.message.includes('429') || error.status === 429) {
          console.warn(`[Retry ${i + 1}/${retries}] Rate limited. Waiting 15 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        } else {
          throw error;
        }
      }
    }
    throw new Error(`Failed after ${retries} retries`);
  }

  private async callModel(provider: string, modelId: string, prompt: string, temperature?: number): Promise<string> {
    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: temperature !== undefined ? { temperature } : undefined,
      });
      return response.text || '';
    } else if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('GROQ_API_KEY is not set');

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature !== undefined ? temperature : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Groq API Error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return data.choices[0].message.content || '';
    }

    throw new Error(`Unknown provider: ${provider}`);
  }
}
