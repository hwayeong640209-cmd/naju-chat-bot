// api/chat.js
import fs from 'fs';
import path from 'path';

// AI 페르소나 및 응답 지침 (System Instruction)
const SYSTEM_INSTRUCTION = `
당신은 '한국도로교통공단 전남운전면허시험장'의 친절하고 논리적인 AI 도우미입니다.

[답변 작성 원칙]
1. 톤앤매너: 항상 상냥하고, 논리적이며, 깔끔하게 정돈된 어조로 답변하세요.
2. 답변 우선순위:
   - 1순위: [기본 안내 메모] 내용을 바탕으로 답변합니다.
   - 2순위: 기본 메모에 없고 [PDF 보충 정보]에 내용이 있다면 이를 활용해 답변합니다.
3. 모르는 내용 처리 (★매우 중요★):
   - 제공된 메모([기본 안내 메모], [PDF 보충 정보])에 없는 내용이거나 불확실한 질문을 받으면, 절대로 아는 척을 하거나 추측/거짓말을 하지 마세요.
   - 다음과 같이 솔직하게 안내하세요:
     "죄송합니다. 요청하신 내용은 현재 제가 가지고 있는 안내 정보에 포함되어 있지 않습니다. 질문해 주신 내용을 잘 기록해 두었다가, 추후 정확한 답변을 드릴 수 있도록 준비하겠습니다. 자세한 사항은 한국도로교통공단 고객지원센터(1588-1588)로 문의해 주시면 친절히 안내받으실 수 있습니다."
4. 표기 규칙:
   - 답변 하단에는 항상 다음 저작권 표기를 포함하세요:
     © 2026 [한국도로교통공단 박화영] All Rights Reserved.
`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 카카오톡 챗봇 요청(userRequest.utterance) 및 일반 Web 요청(prompt) 감지
        const userQuery = req.body.userRequest?.utterance || req.body.prompt;
        const history = req.body.history;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(200).json({
                version: "2.0",
                template: { outputs: [{ simpleText: { text: "서버 설정 오류: GEMINI_API_KEY가 등록되지 않았습니다." } }] }
            });
        }

        // 테스트용 문구("발화 내용")이거나 빈 값인 경우 기본 안내
        if (!userQuery || userQuery === "발화 내용") {
            return res.status(200).json({
                version: "2.0",
                template: { outputs: [{ simpleText: { text: "안녕하세요! 전남운전면허시험장 AI 도우미입니다. 무엇을 도와드릴까요?" } }] }
            });
        }

        // 외부 파일(memo.txt, pdf_context.txt) 불러오기
        const memoPath = path.join(process.cwd(), 'data', 'memo.txt');
        const pdfContextPath = path.join(process.cwd(), 'data', 'pdf_context.txt');

        const baseContext = fs.existsSync(memoPath) ? fs.readFileSync(memoPath, 'utf-8') : '';
        const pdfContext = fs.existsSync(pdfContextPath) ? fs.readFileSync(pdfContextPath, 'utf-8') : '';

        const chatHistory = Array.isArray(history) ? history : [];

        // Gemini API 데이터 세팅
        const contents = [
            {
                role: 'user',
                parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n--- [기본 안내 메모] ---\n${baseContext}\n\n--- [PDF 보충 정보] ---\n${pdfContext}` }]
            },
            {
                role: 'model',
                parts: [{ text: '네, 알겠습니다. 안내해 주신 기본 메모와 PDF 보충 정보를 기반으로 상냥하고 정확하게 답변해 드리겠습니다.' }]
            },
            ...chatHistory,
            {
                role: 'user',
                parts: [{ text: userQuery }]
            }
        ];

        // Gemini API 호출
        const apiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents })
            }
        );

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error('Gemini API Error:', data);
            return res.status(200).json({
                version: "2.0",
                template: { outputs: [{ simpleText: { text: "Gemini API 응답 처리 중 오류가 발생했습니다." } }] }
            });
        }

        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';

        // 카카오톡 챗봇 성공 응답 포맷
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
        console.error('Server Error:', error);
        return res.status(200).json({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: "죄송합니다. 시스템 처리 중 오류가 발생했습니다."
                        }
                    }
                ]
            }
        });
    }
}
