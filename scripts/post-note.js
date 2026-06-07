async function postToNote(title, body) {
  const sessionId = process.env.NOTE_SESSION_ID;

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `_note_session_id=${sessionId}`,
    'User-Agent': 'Mozilla/5.0 (compatible; NexcessBot/1.0)',
    'Referer': 'https://editor.note.com',
    'Origin': 'https://editor.note.com',
  };

  // Step1: 下書き作成
  const createRes = await fetch('https://editor.note.com/api/v2/text_notes', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text_note: {
        name: title,
        body: body,
        status: 'draft',
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Note下書き作成失敗 [${createRes.status}]: ${err}`);
  }

  const createData = await createRes.json();
  const noteKey = createData.data?.key;
  if (!noteKey) throw new Error(`note keyが取得できませんでした: ${JSON.stringify(createData)}`);

  // Step2: 公開
  const publishRes = await fetch(`https://editor.note.com/api/v2/text_notes/${noteKey}/publish`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'published' }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`Note公開失敗 [${publishRes.status}]: ${err}`);
  }

  const publishData = await publishRes.json();
  return publishData.data?.note_url ?? `https://note.com/nexccess/n/${noteKey}`;
}
