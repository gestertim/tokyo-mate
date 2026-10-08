import { createOpenAIClient, getOpenAIModel } from './_lib/openai.js';
import { failure, isNonEmptyString, isRecord, readJsonBody, success } from './_lib/http.js';
import { createPaidEndpointBoundary, type PaidBoundaryOptions } from './_lib/paid-endpoint-boundary.js';
import { buildPhotoTranslationTexts } from './_lib/upstream-text-inputs.js';

export const createHandler = (options?: PaidBoundaryOptions) => createPaidEndpointBoundary('photo-translate', options);
export const POST = createHandler();

const MAX_SOURCE_TEXT_LENGTH = 2000;
const allowedTargetLanguages = new Set(['zh-TW', 'ja']);

const invalidInput = {
  code: 'INVALID_INPUT' as const,
  userTitle: '無法翻譯',
  userMessage: '翻譯內容或目標語言不正確。',
  actionableStep: '請重新選取文字區域後再試一次。',
};

const serviceUnavailable = {
  code: 'AI_SERVICE_UNAVAILABLE' as const,
  userTitle: '翻譯服務暫時無法使用',
  userMessage: '目前無法完成翻譯。',
  actionableStep: '請重新嘗試翻譯。',
};

type TargetLanguage = 'zh-TW' | 'ja';

interface PhotoTranslateRequestBody {
  sourceText?: unknown;
  targetLanguage?: unknown;
}

type TranslateProviderResult =
  | { sameLanguage: true }
  | { sameLanguage: false; translatedText: string };

export async function executeUpstream(request: Request): Promise<Response> {
  let body: PhotoTranslateRequestBody;
  try {
    body = await readJsonBody<PhotoTranslateRequestBody>(request);
  } catch {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  const { sourceText, targetLanguage } = body;

  if (!isNonEmptyString(sourceText, MAX_SOURCE_TEXT_LENGTH)) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  if (typeof targetLanguage !== 'string' || !allowedTargetLanguages.has(targetLanguage)) {
    return Response.json(failure(invalidInput), { status: 400 });
  }

  try {
    const client = createOpenAIClient() as unknown as {
      responses: { create: (input: unknown) => Promise<{ output_text?: string }> };
    };
    const model = getOpenAIModel();
    const [instruction, source] = buildPhotoTranslationTexts(sourceText, targetLanguage as TargetLanguage);
    const response = await client.responses.create({
      model,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: instruction },
            {
              type: 'input_text',
              text: source,
            },
          ],
        },
      ],
    });

    const result = parseTranslateResult(response.output_text);
    if (!result) {
      return Response.json(failure(serviceUnavailable), { status: 500 });
    }

    return Response.json(success({ ...result, targetLanguage }));
  } catch {
    return Response.json(failure(serviceUnavailable), { status: 500 });
  }
}

function parseTranslateResult(outputText: string | undefined): TranslateProviderResult | undefined {
  if (!outputText) return undefined;
  try {
    const parsed = JSON.parse(outputText) as { sameLanguage?: unknown; translatedText?: unknown };
    if (typeof parsed.sameLanguage !== 'boolean') return undefined;
    if (parsed.sameLanguage) {
      return { sameLanguage: true };
    }
    if (typeof parsed.translatedText !== 'string' || parsed.translatedText.trim().length === 0) {
      return undefined;
    }
    return { sameLanguage: false, translatedText: parsed.translatedText };
  } catch {
    return undefined;
  }
}
