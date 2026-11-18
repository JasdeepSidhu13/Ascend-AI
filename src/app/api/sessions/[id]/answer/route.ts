import { json, withProfile } from "@/lib/http";
import { answerQuestion } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withProfile(request, async (profile) => {
    const body = (await request.json()) as {
      questionId: string;
      valueNum?: number | null;
      valueText?: string | null;
      valueJson?: unknown;
      skipped?: boolean;
    };
    const result = await answerQuestion({
      userId: profile.id,
      sessionId: id,
      questionId: body.questionId,
      valueNum: body.valueNum,
      valueText: body.valueText,
      valueJson: body.valueJson,
      skipped: body.skipped,
    });
    if ("error" in result) return json({ error: result.error }, 404);
    return json(result);
  });
}
