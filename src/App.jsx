import { useEffect, useState } from "react";

/* 위도/경도 -> 기상청 격자 */
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

/* 현재 날씨 기준시각 */
function getUltraBaseDateTime() {
  const now = new Date();
  const hours = now.getHours();

  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
  let baseHour = baseTimes[0];

  for (let i = baseTimes.length - 1; i >= 0; i--) {
    if (hours >= baseTimes[i]) {
      baseHour = baseTimes[i];
      break;
    }
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return {
    base_date: `${year}${month}${day}`,
    base_time: String(baseHour).padStart(2, "0") + "00",
  };
}

/* 단기예보 기준시각 */
function getVillageBaseDateTime() {
  const now = new Date();
  const current = new Date(now);

  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let selected = 23;

  if (current.getHours() < 2) {
    current.setDate(current.getDate() - 1);
    selected = 23;
  } else {
    for (let i = baseHours.length - 1; i >= 0; i--) {
      if (current.getHours() >= baseHours[i]) {
        selected = baseHours[i];
        break;
      }
    }
  }

  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");

  return {
    base_date: `${year}${month}${day}`,
    base_time: String(selected).padStart(2, "0") + "00",
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getWeekday(dateStr) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(4, 6)) - 1;
  const day = Number(dateStr.slice(6, 8));
  const date = new Date(year, month, day);
  return `${days[date.getDay()]}요일`;
}

function convertSky(code) {
  if (code === "1") return "맑음";
  if (code === "3") return "구름많음";
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

function App() {
  const [weather, setWeather] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const { nx, ny } = convertToGrid(lat, lon);

          const weatherKey = import.meta.env.VITE_WEATHER_API_KEY;

          /* 현재 날씨 */
          const ultraBase = getUltraBaseDateTime();

          const currentUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(
            weatherKey
          )}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${
            ultraBase.base_date
          }&base_time=${ultraBase.base_time}&nx=${nx}&ny=${ny}`;

          const currentRes = await fetch(currentUrl);
          const currentData = await currentRes.json();
          const currentItems = currentData?.response?.body?.items?.item ?? [];

          const parsedCurrent = {
            temp: null,
            humidity: null,
            wind: null,
            rain: null,
          };

          currentItems.forEach((item) => {
            if (item.category === "T1H") parsedCurrent.temp = item.obsrValue;
            if (item.category === "REH") parsedCurrent.humidity = item.obsrValue;
            if (item.category === "WSD") parsedCurrent.wind = item.obsrValue;
            if (item.category === "RN1") parsedCurrent.rain = item.obsrValue;
          });

          setWeather(parsedCurrent);

          /* 앞으로의 날씨 */
          const villageBase = getVillageBaseDateTime();

          const villageUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(
            weatherKey
          )}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${
            villageBase.base_date
          }&base_time=${villageBase.base_time}&nx=${nx}&ny=${ny}`;

          const villageRes = await fetch(villageUrl);
          const villageData = await villageRes.json();
          const villageItems = villageData?.response?.body?.items?.item ?? [];

          const byDate = {};

          villageItems.forEach((item) => {
            const date = item.fcstDate;
            const time = item.fcstTime;

            if (!byDate[date]) {
              byDate[date] = {
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

            if (item.category === "TMN") {
              byDate[date].minTemp = Number(item.fcstValue);
            }

            if (item.category === "TMX") {
              byDate[date].maxTemp = Number(item.fcstValue);
            }

            if (item.category === "TMP") {
              byDate[date].tmpValues.push(Number(item.fcstValue));
            }

            if (item.category === "SKY" && !byDate[date].anySky) {
              byDate[date].anySky = item.fcstValue;
            }

            if (item.category === "PTY" && !byDate[date].anyPty) {
              byDate[date].anyPty = item.fcstValue;
            }

            if (time === "1200") {
              if (item.category === "SKY") byDate[date].noonSky = item.fcstValue;
              if (item.category === "PTY") byDate[date].noonPty = item.fcstValue;
            }
          });

          const todayStr = formatDate(new Date());

          const weeklyList = Object.values(byDate)
            .filter((item) => item.date > todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((item) => {
              const ptyCode = item.noonPty || item.anyPty;
              const skyCode = item.noonSky || item.anySky;

              const weatherText =
                convertPty(ptyCode) || convertSky(skyCode) || null;

              const calculatedMin =
                item.minTemp !== null
                  ? item.minTemp
                  : item.tmpValues.length > 0
                  ? Math.min(...item.tmpValues)
                  : null;

              const calculatedMax =
                item.maxTemp !== null
                  ? item.maxTemp
                  : item.tmpValues.length > 0
                  ? Math.max(...item.tmpValues)
                  : null;

              return {
                day: getWeekday(item.date),
                weather: weatherText,
                minTemp: calculatedMin,
                maxTemp: calculatedMax,
              };
            })
            .filter(
              (item) =>
                item.weather !== null &&
                item.minTemp !== null &&
                item.maxTemp !== null
            )
            .slice(0, 5)
            .map((item) => ({
              ...item,
              minTemp: Number(item.minTemp).toFixed(1),
              maxTemp: Number(item.maxTemp).toFixed(1),
            }));

          setWeekly(weeklyList);
        } catch (err) {
          console.error("에러:", err);
          setError("날씨 데이터를 불러오는 중 오류가 발생했습니다.");
        }
      },
      (geoError) => {
        console.error("위치 에러:", geoError);
        setError("위치 정보를 가져오지 못했습니다.");
      }
    );
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Wearther</h1>

      {error && <p>{error}</p>}

      {!weather && !error && <p>날씨 불러오는 중...</p>}

      {weather && (
        <div>
          <h2>현재 날씨</h2>
          <p>기온: {weather.temp}°C</p>
          <p>습도: {weather.humidity}%</p>
          <p>풍속: {weather.wind} m/s</p>
          <p>강수량: {weather.rain} mm</p>
        </div>
      )}

      {weekly.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h2>앞으로의 날씨</h2>
          {weekly.map((item, index) => (
            <p key={index}>
              {item.day}: {item.weather} / 최저 {item.minTemp}°C / 최고 {item.maxTemp}°C
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;