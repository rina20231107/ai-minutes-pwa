const ALLOWED_ORIGIN = 'https://rina20231107.github.io';
const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin'
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    if (origin !== ALLOWED_ORIGIN) return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: corsHeaders(origin) });
    if (!env.OPENAI_API_KEY) return Response.json({ error: 'Server is not configured' }, { status: 500, headers: corsHeaders(origin) });
    const url = new URL(request.url);
    if (url.pathname === '/minutes') return createMinutes(request, env, origin);
    try {
      const incoming = await request.formData();const file = incoming.get('file');
      if (!(file instanceof File)) return Response.json({ error: '音声ファイルがありません' }, { status: 400, headers: corsHeaders(origin) });
      if (file.size > 25 * 1024 * 1024) return Response.json({ error: '音声ファイルは25MB以下にしてください' }, { status: 413, headers: corsHeaders(origin) });
      const body = new FormData();body.append('file', file, file.name || 'recording.m4a');body.append('model', 'gpt-4o-mini-transcribe');body.append('language', incoming.get('language') || 'ja');body.append('prompt', '日本語の会議、研修、打ち合わせの文字起こしです。固有名詞、数字、専門用語をできるだけ正確に記録してください。');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body });
      const result = await response.json();
      if (!response.ok) return Response.json({ error: result?.error?.message || 'OpenAI APIでエラーが発生しました' }, { status: response.status, headers: corsHeaders(origin) });
      return Response.json({ text: result.text || '' }, { headers: { ...corsHeaders(origin), 'Cache-Control': 'no-store' } });
    } catch { return Response.json({ error: '文字起こし処理に失敗しました' }, { status: 500, headers: corsHeaders(origin) }); }
  }
};

async function createMinutes(request, env, origin) {
  try {
    const incoming = await request.json();
    const transcript = String(incoming?.transcript || '').trim();
    if (!transcript) return Response.json({ error: '文字起こし結果がありません' }, { status: 400, headers: corsHeaders(origin) });
    if (transcript.length > 120000) return Response.json({ error: '文字起こしが長すぎます。分割してお試しください' }, { status: 413, headers: corsHeaders(origin) });
    const metadata = incoming?.metadata || {};
    const schema = {
      type: 'object', additionalProperties: false,
      properties: {
        meeting_title: { type: 'string' }, date_time: { type: 'string' }, place: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' },
        agenda: { type: 'array', items: { type: 'string' } }, discussion: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } }, issues: { type: 'array', items: { type: 'string' } },
        todos: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { task: { type: 'string' }, assignee: { type: 'string' }, deadline: { type: 'string' } }, required: ['task','assignee','deadline'] } },
        important_notes: { type: 'array', items: { type: 'string' } }
      },
      required: ['meeting_title','date_time','place','attendees','summary','agenda','discussion','decisions','issues','todos','important_notes']
    };
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-mini', store: false,
        instructions: 'あなたは日本語の会議議事録作成者です。文字起こしに明記された事実だけを使用してください。推測や創作は禁止です。不明な単一項目は「不明」、該当する内容がない配列は空配列にしてください。発言の言いよどみや重複は整理し、簡潔で実務的な文章にしてください。ユーザーが入力した会議情報は文字起こしより優先してください。',
        input: `会議情報:\n会議名: ${metadata.meeting_title||'不明'}\n日時: ${metadata.date_time||'不明'}\n場所: ${metadata.place||'不明'}\n出席者: ${metadata.attendees||'不明'}\n\n文字起こし:\n${transcript}`,
        text: { format: { type: 'json_schema', name: 'meeting_minutes', strict: true, schema }, verbosity: 'low' }
      })
    });
    const result = await response.json();
    if (!response.ok) return Response.json({ error: result?.error?.message || 'OpenAI APIでエラーが発生しました' }, { status: response.status, headers: corsHeaders(origin) });
    const outputText = result.output_text || result.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!outputText) return Response.json({ error: '議事録の生成結果が空でした' }, { status: 502, headers: corsHeaders(origin) });
    return Response.json({ minutes: JSON.parse(outputText) }, { headers: { ...corsHeaders(origin), 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: '議事録作成処理に失敗しました' }, { status: 500, headers: corsHeaders(origin) }); }
}
