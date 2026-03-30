import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const pexelsApiKey = process.env.PEXELS_API_KEY;

app.use(cors());
app.use(express.json());

function sanitizeRecommendation(parsed) {
  const items = Array.isArray(parsed?.items)
    ? parsed.items
        .filter(
          (item) =>
            item?.category &&
            item?.recommendation &&
            item?.reason &&
            item?.searchQuery
        )
        .slice(0, 5)
        .map((item) => ({
          category: item.category,
          recommendation: item.recommendation,
          reason: item.reason,
          searchQuery: item.searchQuery,
          images: Array.isArray(item.images) ? item.images.slice(0, 3) : [],
        }))
    : [];

  return {
    headline: parsed?.headline || "오늘 날씨에 맞춘 복장을 추천했어요.",
    summary: parsed?.summary || "기온과 강수 가능성을 고려해 바로 입기 좋은 조합을 정리했습니다.",
    items:
      items.length > 0
        ? items
        : [
            {
              category: "기본 추천",
              recommendation: "가벼운 레이어드",
              reason: "기온 변화에 대응하기 쉽고 실내외 온도 차를 조절하기 좋습니다.",
              searchQuery: "light layering outfit",
              images: [],
            },
          ],
    stylingTip:
      parsed?.stylingTip ||
      "베이스 아이템은 단정하게 두고, 아우터나 신발로 분위기를 조절해보세요.",
    caution:
      parsed?.caution ||
      "강수량과 바람 정보를 확인해 우산이나 얇은 겉옷을 함께 준비하면 좋습니다.",
  };
}

function getTemperatureBand(temp) {
  if (temp >= 28) return "hot";
  if (temp >= 22) return "warm";
  if (temp >= 16) return "mild";
  if (temp >= 9) return "cool";
  return "cold";
}

function createFallbackItems(temp, themeLabel) {
  const band = getTemperatureBand(temp);
  const isPractical = String(themeLabel || "").includes("실용");

  const presets = {
    hot: [
      {
        category: "상의",
        recommendation: isPractical ? "통기성 좋은 반팔 티셔츠" : "깔끔한 반팔 셔츠",
        reason: "더운 날씨라 가볍고 시원한 상의가 좋습니다.",
        searchQuery: isPractical ? "breathable t shirt outfit" : "clean short sleeve shirt outfit",
      },
      {
        category: "하의",
        recommendation: isPractical ? "가벼운 밴딩 팬츠" : "얇은 슬랙스",
        reason: "답답하지 않으면서 움직이기 편한 하의가 어울립니다.",
        searchQuery: isPractical ? "light banding pants outfit" : "light slacks outfit",
      },
      {
        category: "신발",
        recommendation: "가벼운 스니커즈",
        reason: "장시간 착용해도 부담이 적고 다양한 코디에 잘 맞습니다.",
        searchQuery: "light sneakers outfit",
      },
      {
        category: "소품",
        recommendation: "얇은 캡모자 또는 선글라스",
        reason: "강한 햇빛을 막아주고 여름 느낌을 더해줍니다.",
        searchQuery: "cap sunglasses summer outfit",
      },
    ],
    warm: [
      {
        category: "상의",
        recommendation: isPractical ? "긴팔 티셔츠 또는 얇은 셔츠" : "단정한 셔츠",
        reason: "낮에는 가볍고 저녁엔 너무 춥지 않게 입기 좋습니다.",
        searchQuery: isPractical ? "long sleeve t shirt outfit" : "clean button shirt outfit",
      },
      {
        category: "하의",
        recommendation: isPractical ? "코튼 팬츠" : "슬림 슬랙스",
        reason: "봄가을 날씨에 안정적으로 매치하기 좋습니다.",
        searchQuery: isPractical ? "cotton pants outfit" : "slim slacks outfit",
      },
      {
        category: "아우터",
        recommendation: "얇은 가디건 또는 셔켓",
        reason: "일교차가 생길 때 가볍게 걸치기 좋습니다.",
        searchQuery: "light cardigan shacket outfit",
      },
      {
        category: "신발",
        recommendation: "로우 스니커즈",
        reason: "가볍고 깔끔하게 마무리하기 좋습니다.",
        searchQuery: "low sneakers outfit",
      },
    ],
    mild: [
      {
        category: "상의",
        recommendation: isPractical ? "긴팔 티셔츠" : "니트 또는 셔츠 레이어드",
        reason: "선선한 기온이라 너무 얇지 않은 상의가 안정적입니다.",
        searchQuery: isPractical ? "long sleeve tee outfit" : "knit shirt layered outfit",
      },
      {
        category: "하의",
        recommendation: isPractical ? "조거 팬츠" : "슬랙스",
        reason: "간절기 체감온도에 맞춰 편안하게 입기 좋습니다.",
        searchQuery: isPractical ? "jogger pants outfit" : "slacks outfit",
      },
      {
        category: "아우터",
        recommendation: isPractical ? "바람막이" : "가벼운 자켓",
        reason: "아침저녁 바람과 온도 차이에 대응하기 좋습니다.",
        searchQuery: isPractical ? "windbreaker outfit" : "light jacket outfit",
      },
      {
        category: "신발",
        recommendation: "기본 스니커즈",
        reason: "활동성과 스타일을 모두 챙기기 좋습니다.",
        searchQuery: "basic sneakers outfit",
      },
    ],
    cool: [
      {
        category: "상의",
        recommendation: isPractical ? "도톰한 맨투맨" : "니트 또는 셔츠+니트 조합",
        reason: "쌀쌀한 날씨라 상체 보온을 조금 더 챙기는 편이 좋습니다.",
        searchQuery: isPractical ? "sweatshirt outfit" : "knit layered outfit",
      },
      {
        category: "하의",
        recommendation: "롱 팬츠",
        reason: "기온이 낮아 다리를 충분히 덮는 쪽이 좋습니다.",
        searchQuery: "long pants outfit",
      },
      {
        category: "아우터",
        recommendation: isPractical ? "가벼운 점퍼" : "미니멀 자켓",
        reason: "바람이 불거나 해가 지면 추위를 느낄 수 있습니다.",
        searchQuery: isPractical ? "light jumper outfit" : "minimal jacket outfit",
      },
      {
        category: "신발",
        recommendation: "커버감 있는 스니커즈",
        reason: "계절감에 맞고 활용도가 높습니다.",
        searchQuery: "covered sneakers outfit",
      },
    ],
    cold: [
      {
        category: "상의",
        recommendation: isPractical ? "기모 맨투맨 또는 히트텍 이너" : "니트와 이너 레이어드",
        reason: "낮은 기온이라 기본 보온층이 꼭 필요합니다.",
        searchQuery: isPractical ? "thermal inner sweatshirt outfit" : "knit layered winter outfit",
      },
      {
        category: "하의",
        recommendation: "두께감 있는 팬츠",
        reason: "차가운 바람을 막아주고 체온 유지에 도움이 됩니다.",
        searchQuery: "thick pants winter outfit",
      },
      {
        category: "아우터",
        recommendation: isPractical ? "패딩 또는 방한 점퍼" : "울 코트 또는 패딩",
        reason: "외출 시 체감온도가 더 낮게 느껴질 수 있습니다.",
        searchQuery: isPractical ? "padded jumper outfit" : "wool coat padded outfit",
      },
      {
        category: "신발",
        recommendation: "두께감 있는 스니커즈 또는 부츠",
        reason: "발끝까지 보온을 챙기면 훨씬 편합니다.",
        searchQuery: "winter sneakers boots outfit",
      },
    ],
  };

  return presets[band];
}

function createFallbackRecommendation({ weather, forecast, theme }) {
  const items = createFallbackItems(weather.temp, theme?.label);
  const hasRain = Number(weather?.rain || 0) > 0;
  const windy = Number(weather?.wind || 0) >= 4;
  const upcomingSummary =
    Array.isArray(forecast) && forecast.length > 0
      ? `${forecast[0].day}에는 ${forecast[0].weather} 예보가 있습니다.`
      : "단기 예보는 크게 변하지 않는 흐름입니다.";

  return {
    headline: `${theme?.label || "오늘의 스타일"} 추천을 준비했어요.`,
    summary: `Gemini 호출 한도에 도달해 현재 날씨 기준으로 바로 입기 좋은 조합을 정리했습니다. ${upcomingSummary}`,
    items,
    stylingTip: hasRain
      ? "비 가능성이 있으니 관리 쉬운 아이템 위주로 맞추면 편합니다."
      : "기본 색 조합으로 맞춘 뒤 신발이나 아우터로 분위기를 조절하면 완성도가 올라갑니다.",
    caution: windy
      ? "바람이 있는 편이라 얇아 보여도 겉옷 한 장은 챙기는 편이 좋습니다."
      : "실내외 온도 차를 생각해 탈착 쉬운 레이어드를 추천합니다.",
  };
}

async function searchPexelsImages(query) {
  if (!pexelsApiKey || !query) {
    return [];
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "3");
  url.searchParams.set("page", "1");
  url.searchParams.set("orientation", "portrait");

  const response = await fetch(url, {
    headers: {
      Authorization: pexelsApiKey,
    },
  });

  if (!response.ok) {
    throw new Error("Pexels 이미지 검색에 실패했습니다.");
  }

  const data = await response.json();

  return Array.isArray(data?.photos)
    ? data.photos.slice(0, 3).map((photo) => ({
        id: photo.id,
        alt: photo.alt || query,
        imageUrl: photo.src?.medium || photo.src?.large || photo.src?.original || "",
        photographer: photo.photographer || "Pexels",
        photographerUrl: photo.photographer_url || "https://www.pexels.com",
        pexelsUrl: photo.url || "https://www.pexels.com",
      }))
    : [];
}

async function attachPexelsImages(recommendation) {
  const hydratedItems = await Promise.all(
    recommendation.items.map(async (item) => {
      try {
        const images = await searchPexelsImages(item.searchQuery);
        return { ...item, images };
      } catch {
        return { ...item, images: [] };
      }
    })
  );

  return {
    ...recommendation,
    items: hydratedItems,
    imageProvider: {
      name: "Pexels",
      url: "https://www.pexels.com",
    },
  };
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  }

  return cleaned.slice(start, end + 1);
}

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    model: geminiModel,
    hasGeminiKey: Boolean(geminiApiKey),
    hasPexelsKey: Boolean(pexelsApiKey),
  });
});

app.post("/api/recommendation", async (request, response) => {
  try {
    if (!geminiApiKey) {
      return response.status(500).json({
        error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다.",
      });
    }

    const { weather, forecast, theme, location } = request.body ?? {};

    if (!weather?.temp && weather?.temp !== 0) {
      return response.status(400).json({
        error: "현재 날씨 정보가 누락되었습니다.",
      });
    }

    const prompt = `
당신은 한국 사용자를 위한 날씨 기반 패션 추천 도우미입니다.
아래 날씨 정보를 읽고, "${theme?.label || "기본 스타일"}" 테마에 맞춘 오늘의 복장을 한국어로 추천하세요.

반드시 아래 JSON 형식으로만 답하세요.
{
  "headline": "한 줄 요약 제목",
  "summary": "오늘 복장에 대한 전체 설명",
  "items": [
    {
      "category": "상의",
      "recommendation": "추천 아이템",
      "reason": "추천 이유",
      "searchQuery": "white cotton shirt outfit"
    }
  ],
  "stylingTip": "스타일링 팁",
  "caution": "주의할 점"
}

규칙:
- JSON 외의 텍스트나 마크다운은 출력하지 마세요.
- items는 4개에서 5개 사이로 작성하세요.
- 카테고리는 상의, 하의, 아우터, 신발, 소품 중 필요한 것 위주로 사용하세요.
- 날씨에 따라 우산, 가벼운 겉옷, 통기성, 보온성, 방수성을 적절히 반영하세요.
- 쇼핑몰, 브랜드, 가격 언급은 하지 마세요.
- 사람이 바로 입을 수 있게 구체적으로 추천하세요.
- 각 item에는 Pexels 이미지 검색에 바로 쓸 수 있는 영문 searchQuery를 반드시 포함하세요.
- searchQuery는 2~6 단어의 짧은 영문 패션 키워드로 작성하세요.

현재 위치:
${location?.label || "현재 위치"}

현재 날씨:
- 기온: ${weather.temp}°C
- 습도: ${weather.humidity ?? "정보 없음"}%
- 풍속: ${weather.wind ?? "정보 없음"}m/s
- 강수량: ${weather.rain ?? "정보 없음"}mm

향후 예보:
${Array.isArray(forecast) && forecast.length > 0
  ? forecast
      .map(
        (item) =>
          `- ${item.day}: ${item.weather}, 최저 ${item.minTemp}°C, 최고 ${item.maxTemp}°C`
      )
      .join("\n")
  : "- 추가 예보 정보 없음"}
`.trim();

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      const message =
        geminiData?.error?.message || "Gemini API 호출 중 오류가 발생했습니다.";

      if (
        geminiResponse.status === 429 ||
        String(message).toLowerCase().includes("quota exceeded")
      ) {
        const fallbackRecommendation = createFallbackRecommendation({
          weather,
          forecast,
          theme,
        });
        const recommendationWithImages = await attachPexelsImages(fallbackRecommendation);

        return response.json({
          recommendation: recommendationWithImages,
          meta: {
            source: "fallback",
            reason: "gemini_quota_exceeded",
          },
        });
      }

      return response.status(geminiResponse.status).json({ error: message });
    }

    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") || "";
    const parsed = JSON.parse(extractJson(rawText));
    const recommendation = sanitizeRecommendation(parsed);
    const recommendationWithImages = await attachPexelsImages(recommendation);

    return response.json({
      recommendation: recommendationWithImages,
      meta: {
        source: "gemini",
      },
    });
  } catch (error) {
    return response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "추천 생성 중 알 수 없는 오류가 발생했습니다.",
    });
  }
});

app.listen(port, () => {
  console.log(`Wearther AI server listening on http://localhost:${port}`);
});
