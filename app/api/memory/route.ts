import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const memoryPath = path.join(process.cwd(), 'memory.json');

export async function GET() {
  try {
    const data = await fs.readFile(memoryPath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newMemory = await request.json();
    await fs.writeFile(memoryPath, JSON.stringify(newMemory, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
