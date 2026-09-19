import { createOpenAIClient, getOpenAIModel } from './_lib/openai.js';
import { failure, isRecord, readJsonBody, success } from './_lib/http.js';
import { photoOcrInstruction } from './_lib/prompts/photo-ocr.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const dataUrlPattern = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

const invalidInput = {
  code: 'INVALID_INPUT' as const,
  userTitle: '無法辨識這個選取範圍',
  userMessage: '影像格式或大小不符合需求。',
  actionableStep: '請重新選取範圍或重新選擇照片。',
};

const serviceUnavailable = {
  code: 'AI_SERVICE_UNAVAILABLE' as const,
  userTitle: '辨識服務暫時無法使用',
  userMessage: '目前無法完成文字辨識。',
  actionableStep: '請稍後重試辨識，或重新選取範圍。',
};

interface PhotoOcrRequestBody {
  imageDataUrl?: unknown;
  regionVersion?: unknown;
}

interface OcrProviderResult {
  reliableTextFound: boolean;
  sourceText?: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: PhotoOcrRequestBody;
  try {
    body = await readJsonBody<PhotoOcrRequestBody>(request);
  } catch {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  const { imageDataUrl, regionVersion } = body;

  if (typeof regionVersion !== 'number' || !Number.isInteger(regionVersion) || regionVersion < 1) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  if (typeof imageDataUrl !== 'string') {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  const match = dataUrlPattern.exec(imageDataUrl);
  if (!match) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];
  if (!allowedMimeTypes.has(mimeType)) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  const decodedByteLength = Buffer.byteLength(base64Payload, 'base64');
  if (decodedByteLength === 0 || decodedByteLength > MAX_IMAGE_BYTES) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  try {
    const client = createOpenAIClient() as unknown as {
      responses: { create: (input: unknown) => Promise<{ output_text?: string }> };
    };
    const model = getOpenAIModel();
    const response = await client.responses.create({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: photoOcrInstruction() },
            { type: 'input_image', image_url: imageDataUrl },
          ],
        },
      ],
    });

    const result = parseOcrResult(response.output_text);
    if (!result) {
      return Response.json(failure(serviceUnavailable), { status: 500 });
    }

    return Response.json(success({ ...result, regionVersion }));
  } catch {
    return Response.json(failure(serviceUnavailable), { status: 500 });
  }
}

function parseOcrResult(outputText: string | undefined): OcrProviderResult | undefined {
  if (!outputText) return undefined;
  try {
    const parsed = JSON.parse(outputText) as { reliableTextFound?: unknown; sourceText?: unknown };
    if (typeof parsed.reliableTextFound !== 'boolean') return undefined;
    if (!parsed.reliableTextFound) {
      return { reliableTextFound: false };
    }
    if (typeof parsed.sourceText !== 'string' || parsed.sourceText.trim().length === 0) {
      return undefined;
    }
    return { reliableTextFound: true, sourceText: parsed.sourceText };
  } catch {
    return undefined;
  }
}
