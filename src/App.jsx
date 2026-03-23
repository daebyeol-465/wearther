import { useEffect, useState } from "react";

function App() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const key = import.meta.env.VITE_WEATHER_API_KEY;

    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(
      key
    )}&pageNo=1&numOfRows=10&dataType=JSON&base_date=20260323&base_time=0500&nx=60&ny=127`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const items = data.response.body.items.item;

        const parsed = {
          temp: null,
          humidity: null,
          wind: null,
          rain: null,
        };

        items.forEach((item) => {
          if (item.category === "T1H") parsed.temp = item.obsrValue;
          if (item.category === "REH") parsed.humidity = item.obsrValue;
          if (item.category === "WSD") parsed.wind = item.obsrValue;
          if (item.category === "RN1") parsed.rain = item.obsrValue;
        });

        setWeather(parsed);
      })
      .catch((err) => {
        console.error("에러:", err);
      });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Wearther</h1>

      {!weather && <p>날씨 불러오는 중...</p>}

      {weather && (
        <div>
          <p>기온: {weather.temp}°C</p>
          <p>습도: {weather.humidity}%</p>
          <p>풍속: {weather.wind} m/s</p>
          <p>강수량: {weather.rain} mm</p>
        </div>
      )}
    </div>
  );
}

export default App;