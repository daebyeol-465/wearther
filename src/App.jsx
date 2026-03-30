import { useEffect, useState } from "react";
import "./App.css";

const STYLE_OPTIONS = [
  {
    id: "clean",
    label: "깔끔한 스타일",
    description: "단정하고 정리된 실루엣 중심의 추천",
  },
  {
    id: "practical",
    label: "실용적인 복장",
    description: "활동성과 체온 조절을 우선한 추천",
  },
];

const WEATHER_API_BASE =
  "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

function convertToGrid(lat, lon) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);

  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;

  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

  return { nx, ny };
}

function getUltraBaseDateTime() {
  const now = new Date();
  const hours = now.getHours();
  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
  let baseHour = baseTimes[0];

  for (let index = baseTimes.length - 1; index >= 0; index -= 1) {
    if (hours >= baseTimes[index]) {
      baseHour = baseTimes[index];
      break;
    }
  }

  return {
    base_date: formatDate(new Date()),
    base_time: `${String(baseHour).padStart(2, "0")}00`,
  };
}

function getVillageBaseDateTime() {
  const now = new Date();
  const current = new Date(now);
  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let selected = 23;

  if (current.getHours() < 2) {
    current.setDate(current.getDate() - 1);
  } else {
    for (let index = baseHours.length - 1; index >= 0; index -= 1) {
      if (current.getHours() >= baseHours[index]) {
        selected = baseHours[index];
        break;
      }
    }
  }

  return {
    base_date: formatDate(current),
    base_time: `${String(selected).padStart(2, "0")}00`,
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getWeekday(dateStr) {
  const days = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(4, 6)) - 1;
  const day = Number(dateStr.slice(6, 8));
  return days[new Date(year, month, day).getDay()];
}

function convertSky(code) {
  if (code === "1") return "맑음";
  if (code === "3") return "구름 많음";
  if (code === "4") return "흐림";
  return null;
}

function convertPty(code) {
  if (code === "1") return "비";
  if (code === "2") return "비/눈";
  if (code === "3") return "눈";
  if (code === "4") return "소나기";
  return null;
}

async function fetchLocationLabel(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=ko-KR`
    );

    if (!response.ok) {
      throw new Error("reverse geocoding failed");
    }

    const data = await response.json();
    const address = data?.address ?? {};
    const primaryParts = [
      address.state,
      address.city,
      address.county,
      address.state_district,
      address.city_district,
      address.town,
      address.borough,
      address.suburb,
      address.village,
      address.neighbourhood,
    ].filter(Boolean);

    const uniqueParts = [...new Set(primaryParts)];

    if (uniqueParts.length > 0) {
      return uniqueParts.slice(0, 3).join(" ");
    }

    if (data?.display_name) {
      return data.display_name.split(",").slice(0, 3).join(" ").trim();
    }
  } catch {
    return "현재 위치";
  }

  return "현재 위치";
}

async function fetchWeatherData() {
  if (!navigator.geolocation) {
    throw new Error("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000 * 60 * 10,
    });
  });

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const { nx, ny } = convertToGrid(lat, lon);
  const weatherKey = import.meta.env.VITE_WEATHER_API_KEY;
  const locationLabelPromise = fetchLocationLabel(lat, lon);

  if (!weatherKey) {
    throw new Error("날씨 API 키가 설정되지 않았습니다.");
  }

  const ultraBase = getUltraBaseDateTime();
  const currentUrl = `${WEATHER_API_BASE}/getUltraSrtNcst?serviceKey=${encodeURIComponent(
    weatherKey
  )}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${
    ultraBase.base_date
  }&base_time=${ultraBase.base_time}&nx=${nx}&ny=${ny}`;

  const currentRes = await fetch(currentUrl);
  const currentData = await currentRes.json();
  const currentItems = currentData?.response?.body?.items?.item ?? [];

  if (currentItems.length === 0) {
    throw new Error("현재 날씨 데이터를 가져오지 못했습니다.");
  }

  const parsedCurrent = {
    temp: null,
    humidity: null,
    wind: null,
    rain: null,
  };

  currentItems.forEach((item) => {
    if (item.category === "T1H") parsedCurrent.temp = Number(item.obsrValue);
    if (item.category === "REH") parsedCurrent.humidity = Number(item.obsrValue);
    if (item.category === "WSD") parsedCurrent.wind = Number(item.obsrValue);
    if (item.category === "RN1") parsedCurrent.rain = Number(item.obsrValue);
  });

  const villageBase = getVillageBaseDateTime();
  const villageUrl = `${WEATHER_API_BASE}/getVilageFcst?serviceKey=${encodeURIComponent(
    weatherKey
  )}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${
    villageBase.base_date
  }&base_time=${villageBase.base_time}&nx=${nx}&ny=${ny}`;

  const villageRes = await fetch(villageUrl);
  const villageData = await villageRes.json();
  const villageItems = villageData?.response?.body?.items?.item ?? [];
  const groupedByDate = {};

  villageItems.forEach((item) => {
    const date = item.fcstDate;
    const time = item.fcstTime;

    if (!groupedByDate[date]) {
      groupedByDate[date] = {
        date,
        minTemp: null,
        maxTemp: null,
        tmpValues: [],
        noonSky: null,
        noonPty: null,
        anySky: null,
        anyPty: null,
      };
    }

    if (item.category === "TMN") groupedByDate[date].minTemp = Number(item.fcstValue);
    if (item.category === "TMX") groupedByDate[date].maxTemp = Number(item.fcstValue);
    if (item.category === "TMP") {
      groupedByDate[date].tmpValues.push(Number(item.fcstValue));
    }
    if (item.category === "SKY" && !groupedByDate[date].anySky) {
      groupedByDate[date].anySky = item.fcstValue;
    }
    if (item.category === "PTY" && !groupedByDate[date].anyPty) {
      groupedByDate[date].anyPty = item.fcstValue;
    }
    if (time === "1200" && item.category === "SKY") {
      groupedByDate[date].noonSky = item.fcstValue;
    }
    if (time === "1200" && item.category === "PTY") {
      groupedByDate[date].noonPty = item.fcstValue;
    }
  });

  const today = formatDate(new Date());
  const weekly = Object.values(groupedByDate)
    .filter((item) => item.date > today)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((item) => {
      const precipitationCode = item.noonPty || item.anyPty;
      const skyCode = item.noonSky || item.anySky;
      const minTemp =
        item.minTemp ?? (item.tmpValues.length > 0 ? Math.min(...item.tmpValues) : null);
      const maxTemp =
        item.maxTemp ?? (item.tmpValues.length > 0 ? Math.max(...item.tmpValues) : null);

      return {
        date: item.date,
        day: getWeekday(item.date),
        weather: convertPty(precipitationCode) || convertSky(skyCode) || "정보 없음",
        minTemp,
        maxTemp,
      };
    })
    .filter((item) => item.minTemp !== null && item.maxTemp !== null)
    .slice(0, 5);
  const locationLabel = await locationLabelPromise;

  return {
    location: {
      label: locationLabel,
      lat,
      lon,
      nx,
      ny,
    },
    current: parsedCurrent,
    forecast: weekly,
  };
}

function formatValue(value, unit, digits = 0) {
  if (value === null || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(digits)}${unit}`;
}

async function fetchRecommendationFromApi({
  themeId,
  themeLabel,
  location,
  weather,
  forecast,
}) {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/recommendation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        theme: {
          id: themeId,
          label: themeLabel,
        },
        location,
        weather,
        forecast,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "AI 추천을 불러오지 못했습니다.");
  }

  return data.recommendation;
}

function App() {
  const [weather, setWeather] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [locationInfo, setLocationInfo] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [selectedTheme, setSelectedTheme] = useState(STYLE_OPTIONS[0].id);
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationCache, setRecommendationCache] = useState({});
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      try {
        setWeatherLoading(true);
        setWeatherError("");
        const result = await fetchWeatherData();

        if (cancelled) {
          return;
        }

        setWeather(result.current);
        setWeekly(result.forecast);
        setLocationInfo(result.location);
      } catch (error) {
        if (!cancelled) {
          setWeatherError(
            error instanceof Error
              ? error.message
              : "날씨 데이터를 불러오는 중 오류가 발생했습니다."
          );
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      }
    }

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRecommendationCache({});
    setRecommendation(null);
    setRecommendationError("");
  }, [locationInfo, weather, weekly]);

  useEffect(() => {
    if (!weather) {
      return undefined;
    }

    const cachedRecommendation = recommendationCache[selectedTheme];

    if (cachedRecommendation) {
      setRecommendation(cachedRecommendation);
      setRecommendationError("");
      return undefined;
    }

    let cancelled = false;
    const selectedOption = STYLE_OPTIONS.find((option) => option.id === selectedTheme);

    async function loadRecommendation() {
      try {
        setRecommendationLoading(true);
        setRecommendationError("");

        const nextRecommendation = await fetchRecommendationFromApi({
          themeId: selectedTheme,
          themeLabel: selectedOption?.label ?? selectedTheme,
          location: locationInfo,
          weather,
          forecast: weekly,
        });

        if (!cancelled) {
          setRecommendationCache((previous) => ({
            ...previous,
            [selectedTheme]: nextRecommendation,
          }));
          setRecommendation(nextRecommendation);
        }
      } catch (error) {
        if (!cancelled) {
          setRecommendation(null);
          setRecommendationError(
            error instanceof Error
              ? error.message
              : "AI 추천을 불러오는 중 오류가 발생했습니다."
          );
        }
      } finally {
        if (!cancelled) {
          setRecommendationLoading(false);
        }
      }
    }

    loadRecommendation();

    return () => {
      cancelled = true;
    };
  }, [locationInfo, recommendationCache, selectedTheme, weather, weekly]);

  async function handleRefreshRecommendation() {
    if (!weather || recommendationLoading) {
      return;
    }

    const selectedOption = STYLE_OPTIONS.find((option) => option.id === selectedTheme);

    try {
      setRecommendationLoading(true);
      setRecommendationError("");

      const nextRecommendation = await fetchRecommendationFromApi({
        themeId: selectedTheme,
        themeLabel: selectedOption?.label ?? selectedTheme,
        location: locationInfo,
        weather,
        forecast: weekly,
      });

      setRecommendationCache((previous) => ({
        ...previous,
        [selectedTheme]: nextRecommendation,
      }));
      setRecommendation(nextRecommendation);
    } catch (error) {
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "AI 추천을 불러오는 중 오류가 발생했습니다."
      );
    } finally {
      setRecommendationLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Weather to Wear</p>
          <h1>
            오늘 뭐 입어야 할지,
            <br />
            날씨부터 답해주는 Wearther
          </h1>
          <p className="hero-description">
            현재 날씨와 앞으로의 예보를 바탕으로, AI가 오늘의 복장을 스타일
            테마에 맞춰 정리해줍니다.
          </p>
        </div>

        <div className="hero-panel">
          <p className="panel-label">현재 위치</p>
          <strong>{locationInfo?.label ?? "위치 확인 중"}</strong>
          <span>
            {weatherLoading
              ? "위치와 날씨를 확인하고 있습니다."
              : "현재 날씨를 기준으로 추천을 생성합니다."}
          </span>
        </div>
      </section>

      {weatherError ? (
        <section className="status-card error-card">
          <h2>날씨 정보를 불러오지 못했습니다</h2>
          <p>{weatherError}</p>
        </section>
      ) : null}

      <section className="content-grid">
        <div className="column">
          <section className="card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Current Weather</p>
                <h2>지금 날씨</h2>
              </div>
              {weatherLoading ? <span className="status-chip">불러오는 중</span> : null}
            </div>

            {weather ? (
              <div className="weather-metrics">
                <article className="metric-card">
                  <span>기온</span>
                  <strong>{formatValue(weather.temp, "°C", 1)}</strong>
                </article>
                <article className="metric-card">
                  <span>습도</span>
                  <strong>{formatValue(weather.humidity, "%")}</strong>
                </article>
                <article className="metric-card">
                  <span>풍속</span>
                  <strong>{formatValue(weather.wind, "m/s", 1)}</strong>
                </article>
                <article className="metric-card">
                  <span>강수량</span>
                  <strong>{formatValue(weather.rain, "mm", 1)}</strong>
                </article>
              </div>
            ) : (
              <p className="placeholder">현재 날씨 데이터를 정리하는 중입니다.</p>
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Forecast</p>
                <h2>다가오는 날씨</h2>
              </div>
            </div>

            {weekly.length > 0 ? (
              <div className="forecast-list">
                {weekly.map((item) => (
                  <article className="forecast-item" key={item.date}>
                    <div>
                      <strong>{item.day}</strong>
                      <p>{item.weather}</p>
                    </div>
                    <div className="forecast-temp">
                      <span>최저 {formatValue(item.minTemp, "°C", 1)}</span>
                      <span>최고 {formatValue(item.maxTemp, "°C", 1)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="placeholder">
                예보 데이터가 정리되면 여기에서 확인할 수 있습니다.
              </p>
            )}
          </section>
        </div>

        <div className="column">
          <section className="card recommendation-card">
            <div className="section-head">
              <div>
                <p className="section-kicker">AI Recommendation</p>
                <h2>오늘의 옷 추천</h2>
              </div>
              {recommendationLoading ? (
                <span className="status-chip">AI 분석 중</span>
              ) : null}
            </div>

            <div className="theme-tabs" role="tablist" aria-label="추천 스타일">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`theme-tab ${
                    selectedTheme === option.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedTheme(option.id)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>

            <div className="recommendation-actions">
              <button
                type="button"
                className="refresh-button"
                onClick={handleRefreshRecommendation}
                disabled={!weather || recommendationLoading}
              >
                새로 추천받기
              </button>
            </div>

            {recommendationError ? (
              <div className="inline-status error-card">
                <p>{recommendationError}</p>
              </div>
            ) : null}

            {!recommendation && !recommendationError ? (
              <p className="placeholder">
                날씨를 확인한 뒤 추천을 생성하고 있습니다.
              </p>
            ) : null}

            {recommendation ? (
              <div className="recommendation-body">
                <div className="summary-block">
                  <p className="recommendation-tag">
                    {STYLE_OPTIONS.find((option) => option.id === selectedTheme)?.label}
                  </p>
                  <h3>{recommendation.headline}</h3>
                  <p>{recommendation.summary}</p>
                </div>

                <div className="item-list">
                  {recommendation.items.map((item) => (
                    <article className="item-card" key={`${item.category}-${item.recommendation}`}>
                      <div className="item-head">
                        <span>{item.category}</span>
                        <strong>{item.recommendation}</strong>
                      </div>
                      <p>{item.reason}</p>

                      {item.images?.length > 0 ? (
                        <div className="image-gallery">
                          {item.images.map((image) => (
                            <a
                              key={image.id}
                              className="image-link"
                              href={image.pexelsUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${item.category} 참고 이미지 열기`}
                            >
                              <img
                                className="item-image"
                                src={image.imageUrl}
                                alt={image.alt || item.recommendation}
                                loading="lazy"
                              />
                              <span className="image-credit">{image.photographer}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="image-placeholder">
                          이미지를 불러오지 못했지만 추천 내용은 그대로 사용할 수 있습니다.
                        </p>
                      )}
                    </article>
                  ))}
                </div>

                <div className="tip-grid">
                  <article className="tip-card">
                    <span>스타일 팁</span>
                    <p>{recommendation.stylingTip}</p>
                  </article>
                  <article className="tip-card caution">
                    <span>주의 포인트</span>
                    <p>{recommendation.caution}</p>
                  </article>
                </div>

                {recommendation.imageProvider ? (
                  <p className="provider-note">
                    Images provided by{" "}
                    <a
                      href={recommendation.imageProvider.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {recommendation.imageProvider.name}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
