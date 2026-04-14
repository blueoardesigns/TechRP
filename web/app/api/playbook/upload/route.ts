import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
// @ts-ignore
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  const supabaseAuth = createServerSupabase();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const MAX_SIZE_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum size is 10 MB.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let extractedText = '';

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx');

  if (isPdf) {
    try {
      const result = await pdf(buffer);
      extractedText = result.text;
    } catch {
      return NextResponse.json({ error: 'Failed to read PDF. Make sure it is not password-protected.' }, { status: 422 });
    }
  } else if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } catch {
      return NextResponse.json({ error: 'Failed to read Word document.' }, { status: 422 });
    }
  } else {
    return NextResponse.json(
      { error: 'Unsupported file type. Please upload a PDF (.pdf) or Word document (.docx).' },
      { status: 400 }
    );
  }

  if (!extractedText.trim()) {
    return NextResponse.json(
      { error: 'No readable text found in the document. The file may be image-based or empty.' },
      { status: 422 }
    );
  }

  const truncated = extractedText.slice(0, 12000);
  return NextResponse.json({ extractedText: truncated });
}
