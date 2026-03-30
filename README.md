# Wearther

날씨 데이터를 기반으로 오늘 입을 옷을 추천해주는 웹 서비스입니다. 현재 MVP에서는 기상청 API로 날씨를 가져오고, Node.js 백엔드가 Gemini API와 Pexels API를 호출해 스타일별 추천 문장과 참고 이미지를 함께 제공합니다.

## 실행 방법

1. 루트의 `.env.example`을 참고해서 `.env` 값을 채웁니다.
2. 의존성을 설치합니다.
3. 터미널 2개에서 각각 아래 명령어를 실행합니다.

```bash
npm run server
npm run dev
```

프론트 개발 서버는 `http://localhost:5173`, 백엔드 서버는 `http://localhost:3001`을 사용합니다. Vite 프록시가 `/api` 요청을 백엔드로 전달합니다.

## 환경 변수

```bash
VITE_WEATHER_API_KEY=기상청 API 키
VITE_API_BASE_URL=http://localhost:3001
GEMINI_API_KEY=Gemini API 키
GEMINI_MODEL=gemini-2.5-flash
PEXELS_API_KEY=Pexels API 키
PORT=3001
```

## 현재 구현 범위

- 현재 날씨와 5일 예보 조회
- 기온, 습도, 풍속, 강수량 표시
- 스타일 테마별 AI 옷 추천 생성
- 스타일별 첫 추천 캐시 및 수동 재추천
- 추천 카테고리별 Pexels 이미지 3장 자동 연결
- Gemini 호출을 위한 Express 중계 서버

## 다음 단계 아이디어

- 사용자 취향, 체감온도, 활동 목적을 반영한 개인화
- 추천 결과 저장 및 즐겨찾기
- 추천 실패 시 폴백 문구와 이미지 품질 보정
