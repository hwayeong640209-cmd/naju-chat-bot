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
`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, history } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
        }

        if (!prompt) {
            return res.status(400).json({ error: '질문(prompt)이 없습니다.' });
        }

        // 📁 외부 파일(memo.txt, pdf_context.txt) 불러오기
        const memoPath = path.join(process.cwd(), 'data', 'memo.txt');
        const pdfContextPath = path.join(process.cwd(), 'data', 'pdf_context.txt');

        // 파일이 존재하는지 확인 후 읽기 (없을 경우 빈 문자열 처리)
        const baseContext = fs.existsSync(memoPath) 
            ? fs.readFileSync(memoPath, 'utf-8') 
            : '';
            
        const pdfContext = fs.existsSync(pdfContextPath) 
            ? fs.readFileSync(pdfContextPath, 'utf-8') 
            : '';

        // 프론트엔드에서 넘어온 대화 기록
        const chatHistory = Array.isArray(history) ? history : [];

        // Gemini API 대화 데이터 포맷 세팅
        const contents = [
            {
                role: 'user',
                parts: [{ 
                    text: `${SYSTEM_INSTRUCTION}\n\n--- [기본 안내 메모] ---\n${baseContext}\n\n--- [PDF 보충 정보] ---\n${pdfContext}` 
                }]
            },
            {
                role: 'model',
                parts: [{ text: '네, 알겠습니다. 안내해 주신 기본 메모와 PDF 보충 정보를 기반으로 상냥하고 정확하게 답변해 드리겠습니다.' }]
            },
            ...chatHistory,
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ];

        // Gemini REST API 호출
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
            return res.status(apiResponse.status).json({ error: data.error?.message || 'Gemini API 오류' });
        }

        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성하지 못했습니다.';

        return res.status(200).json({ text: replyText });

    } catch (error) {
        console.error('Server Error:', error);
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
      
    }
}
