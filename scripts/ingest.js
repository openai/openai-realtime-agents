// scripts/ingest.js
import fs from 'fs';
import path from 'path';
import { encode, decode } from 'gpt-3-encoder';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();  // loads .env

// ── Setup Supabase client (Service Role key) ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helper: call OpenAI embeddings ──
async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  const { data } = await res.json();
  return data[0].embedding;
}

// ── Main ingestion logic ──
async function ingestFile(filePath, slug) {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const tokens = encode(raw);
  const chunkSize = 500;
  for (let start = 0, idx = 0; start < tokens.length; start += chunkSize, idx++) {
    const chunkTokens = tokens.slice(start, start + chunkSize);
    const chunkText = decode(chunkTokens);
    const embedding = await embed(chunkText);

    const { error } = await supabase.from('rag_docs').insert({
      doc_slug: slug,
      chunk_index: idx,
      content: chunkText,
      embedding,
    });
    if (error) {
      console.error('Insert failed for chunk', idx, error);
      process.exit(1);
    } else {
      console.log(`✔️ Inserted chunk ${idx} for ${slug}`);
    }
  }
}

// ── Run it ──
(async () => {
  // Replace these with your actual files and slugs:
  await ingestFile('./docs/pricing-framework.txt', 'pricing-framework');
  await ingestFile('./docs/offer-template.txt',      'offer-template');
  console.log('All done!');
  process.exit(0);
})();
