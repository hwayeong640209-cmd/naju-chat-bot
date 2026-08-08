// api/chat.js
import fs from 'fs';
import path from 'path';

const SYSTEM_INSTRUCTION = `
당신은 '한국도로교통공단 전남운전면허시험장'의 친절하고 논리적인 AI 도우미입니다.

[답변 작성 기본 원칙]
1. 질문 핵심 직답 (★가장 중요):
   - 질문에 전체 안내서를 그대로 복사해서 출력하지 마세요.
   - 민원인의 질문에 대해 '가능 여부(예/아니오)'와 '핵심 핵심 조건'을 첫 문장에서 먼저 명확하게 답변하세요.
   - 예시) "학생증만으로는 본인 확인이 어렵습니다. 고등학교 학생증을 사용하시려면 '재학증명서'를 반드시 함께 지참하셔야 합니다."

2. 세부 조건 및 부가 안내:
   - 핵심 답변을 먼저 전달한 뒤, 필요한 세부 요건(사진/성명 포함 여부, 학교장 직인, 주민번호 13자리 표기 등)을 깔끔한 번호나 불렛(•) 목록으로 정리해 안내하세요.

3. 정보 출처 우선순위:
   - 1순위: [기본 안내 메모]
   - 2순위: [PDF 보충 정보]

4. 정보가 없거나 불확실한 질문:
   - 아는 척을 하지 말고 솔직히 안내하세요:
     "죄송합니다. 요청하신 내용은 현재 제가 가지고 있는 안내 정보에 포함되어 있지 않습니다. 자세한 사항은 한국도로교통공단 고객지원센터(1588-1588)로 문의해 주시면 친절히 안내받으실 수 있습니다."
`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const userQuery = req.body.userRequest?.utterance || req.body.prompt;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(200).json({
                version: "2.0",
                template: { outputs: [{ simpleText: { text: "서버 오류: GEMINI_API_KEY가 설정되지 않았습니다." } }] }
            });
        }

        if (!userQuery || userQuery === "발화 내용") {
            return res.status(200).json({
                version: "2.0",
                template: { outputs: [{ simpleText: { text: "안녕하세요! 전남운전면허시험장 AI 도우미입니다. 무엇을 도와드릴까요?" } }] }
            });
        }

        // 파일 읽기 (경로 예외 처리)
        let baseContext = '';
        let pdfContext = '';
        try {
            const memoPath = path.join(process.cwd(), 'data', 'memo.txt');
            const pdfContextPath = path.join(process.cwd(), 'data', 'pdf_context.txt');
            if (fs.existsSync(memoPath)) baseContext = fs.readFileSync(memoPath, 'utf-8');
            if (fs.existsSync(pdfContextPath)) pdfContext = fs.readFileSync(pdfContextPath, 'utf-8');
        } catch (e) {
            console.error("파일 읽기 에러:", e);
        }

        const promptText = `${SYSTEM_INSTRUCTION}\n\n[기본 메모]\n${baseContext}\n\n[보충 정보]\n${pdfContext}\n\n[사용자 질문]\n${userQuery}`;

        // Gemini REST API 호출
        const apiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: promptText }]
                        }
                    ]
                })
            }
        );

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Gemini API 반환 에러 Detail:', JSON.stringify(data));
            const errorMsg = data.error?.message || 'API 응답 오류';
            return res.status(200).json({
                version: "2.0",
                template: { outputs: [{ simpleText: { text: `Gemini API 오류: ${errorMsg}` } }] }
            });
        }

        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';

        return res.status(200).json({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: replyText
                        }
                    }
                ]
            }
        });

    } catch (error) {
        console.error('Server Catch Error:', error);
        return res.status(200).json({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: "시스템 처리 중 에러가 발생했습니다."
                        }
                    }
                ]
            }
        });
    }
}
