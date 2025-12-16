// --- 1. STATE & VARIABLES ---
let currentCity = "Chennai"; // Default
let isDark = false;
const savedFavs = JSON.parse(localStorage.getItem('genieFavs')) || ["Bangalore", "Mumbai"];

// --- 2. START SCREEN LOGIC ---
function enterApp() {
    document.getElementById('splashScreen').style.transition = "opacity 0.5s";
    document.getElementById('splashScreen').style.opacity = "0";
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = "none";
        document.getElementById('appContainer').style.display = "block";
        getWeather(); // Load weather on entry
    }, 500);
}

// --- 3. MAIN WEATHER LOGIC (Open-Meteo API) ---
async function getWeather() {
    const input = document.getElementById('cityInput').value;
    if(input) currentCity = input;

    // Loading State
    document.getElementById('condition').innerText = "Scanning...";

    try {
        // A. Geocoding (Name -> Lat/Lon)
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${currentCity}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if(!geoData.results) {
            alert("City not found! Check spelling.");
            return;
        }

        const { latitude, longitude, name, admin1 } = geoData.results[0];
        document.getElementById('displayLocation').innerText = name;
        currentCity = name; // Auto-correct case

        // B. Fetch Weather & AQI (Parallel Requests)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=7`;
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi`;

        const [weatherRes, aqiRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
        const data = await weatherRes.json();
        const aqiData = await aqiRes.json();

        updateUI(data, aqiData);

    } catch (e) {
        console.error(e);
        document.getElementById('condition').innerText = "Error!";
    }
}

// Get Location via GPS
function getDeviceLocation() {
    if(navigator.geolocation) {
        document.getElementById('displayLocation').innerText = "GPS...";
        navigator.geolocation.getCurrentPosition(pos => {
            fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        });
    } else {
        alert("GPS not supported");
    }
}

async function fetchWeatherByCoords(lat, lon) {
    // Reverse Geocode (Optional, but keeping it simple, just load weather)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;
    
    const [weatherRes, aqiRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
    const data = await weatherRes.json();
    const aqiData = await aqiRes.json();
    
    document.getElementById('displayLocation').innerText = "My Location";
    updateUI(data, aqiData);
}

// --- 4. UI UPDATE LOGIC ---
function updateUI(data, aqiData) {
    const cur = data.current;
    const daily = data.daily;
    
    // 1. Hero Section
    document.getElementById('temp').innerText = Math.round(cur.temperature_2m) + "°";
    document.getElementById('feelsLike').innerText = Math.round(cur.apparent_temperature) + "°";
    document.getElementById('humidity').innerText = cur.relative_humidity_2m + "%";
    document.getElementById('wind').innerText = cur.wind_speed_10m + " km/h";
    
    const weatherInfo = getWeatherDetails(cur.weather_code);
    document.getElementById('weatherIcon').innerText = weatherInfo.icon;
    document.getElementById('condition').innerText = weatherInfo.text;
    
    // 2. AQI & UV
    const aqi = aqiData.current.us_aqi;
    const uv = daily.uv_index_max[0];
    
    document.getElementById('aqiVal').innerText = aqi;
    document.getElementById('uvVal').innerText = uv;
    
    // AQI Status Logic & Bar
    let aqiText = "Good"; let aqiColor = "#00e400"; let width = "20%";
    if(aqi > 50) { aqiText = "Moderate"; aqiColor = "#ffff00"; width = "40%"; }
    if(aqi > 100) { aqiText = "Unhealthy"; aqiColor = "#ff7e00"; width = "60%"; }
    if(aqi > 150) { aqiText = "Poor"; aqiColor = "#ff0000"; width = "80%"; }
    
    document.getElementById('aqiStatus').innerText = aqiText;
    document.getElementById('aqiStatus').style.color = aqiColor;
    document.getElementById('aqiBar').style.width = width;
    document.getElementById('aqiBar').style.background = aqiColor;
    
    document.getElementById('uvStatus').innerText = uv > 5 ? "High" : "Low";

    // 3. Smart Advice
    document.getElementById('adviceText').innerText = generateAdvice(cur.weather_code, cur.temperature_2m, aqi);

    // 4. Background Gradient (Day/Night)
    if(cur.is_day === 0) {
        document.body.style.background = "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)"; // Night
    } else {
        // Change based on weather code later if needed, default is blue
        document.body.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    }

    // 5. Hourly Forecast (Loop next 24 hours)
    const hourlyContainer = document.getElementById('hourlyContainer');
    hourlyContainer.innerHTML = "";
    
    const currentHour = new Date().getHours();
    let count = 0;
    
    // OpenMeteo gives 7 days hourly, we need to find current index
    const hourIndex = parseInt(currentHour); // Rough estimate match
    
    for(let i = hourIndex; i < hourIndex + 24; i++) {
        // Safety check
        if(!data.hourly.time[i]) break;
        
        const timeStr = data.hourly.time[i]; // ISO String
        const dateObj = new Date(timeStr);
        const h = dateObj.getHours();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        
        const hCode = data.hourly.weather_code[i];
        const hTemp = Math.round(data.hourly.temperature_2m[i]);
        const hIcon = getWeatherDetails(hCode).icon;
        
        const div = document.createElement('div');
        div.className = "hourly-item";
        div.innerHTML = `<span>${displayH} ${ampm}</span><div style="font-size:1.5rem">${hIcon}</div><strong>${hTemp}°</strong>`;
        hourlyContainer.appendChild(div);
    }

    // 6. Daily Forecast (Next 7 days)
    const dailyContainer = document.getElementById('dailyContainer');
    dailyContainer.innerHTML = "";
    
    for(let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const max = Math.round(daily.temperature_2m_max[i]);
        const min = Math.round(daily.temperature_2m_min[i]);
        const code = daily.weather_code[i];
        const icon = getWeatherDetails(code).icon;
        
        const row = document.createElement('div');
        row.className = "daily-row";
        row.innerHTML = `
            <span class="day-name">${dayName}</span>
            <span class="day-icon">${icon}</span>
            <span class="day-temp">${max}° / ${min}°</span>
        `;
        dailyContainer.appendChild(row);
    }
}

// --- 5. HELPER FUNCTIONS ---
function getWeatherDetails(code) {
    if (code === 0) return { icon: "☀️", text: "Clear" };
    if (code >= 1 && code <= 3) return { icon: "🌤️", text: "Cloudy" };
    if (code >= 45 && code <= 48) return { icon: "🌫️", text: "Foggy" };
    if (code >= 51 && code <= 67) return { icon: "🌧️", text: "Rain" };
    if (code >= 71 && code <= 77) return { icon: "❄️", text: "Snow" };
    if (code >= 95) return { icon: "⛈️", text: "Storm" };
    return { icon: "🌡️", text: "Moderate" };
}

function generateAdvice(code, temp, aqi) {
    if (code >= 95) return "⛈️ Storm incoming! Stay indoors.";
    if (code >= 51) return "☔ Carry an umbrella, machi!";
    if (aqi > 100) return "😷 Air quality is bad, wear a mask.";
    if (temp > 35) return "🥵 Drink water, it's roasting!";
    if (temp < 20) return "🧣 Grab a jacket, getting chilly.";
    return "✨ Perfect weather! Enjoy the day.";
}

function toggleDarkMode() {
    isDark = !isDark;
    if(isDark) {
        document.body.style.background = "#1a1a1a";
        document.querySelector('.app-container').style.color = "#eee";
    } else {
        document.body.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        document.querySelector('.app-container').style.color = "#fff";
    }
    // Re-trigger fetch to fix gradient if needed
}

// Favorites Logic
function toggleFavorites() {
    const list = document.getElementById('favoritesList');
    list.style.display = list.style.display === 'block' ? 'none' : 'block';
    renderFavs();
}

function renderFavs() {
    const container = document.getElementById('favItems');
    container.innerHTML = "";
    savedFavs.forEach(city => {
        const div = document.createElement('div');
        div.className = "fav-item";
        div.innerHTML = `<span>${city}</span> <span onclick="loadFav('${city}')">➡️</span>`;
        container.appendChild(div);
    });
}

function addFavorite() {
    const val = document.getElementById('favInput').value;
    if(val && !savedFavs.includes(val)) {
        savedFavs.push(val);
        localStorage.setItem('genieFavs', JSON.stringify(savedFavs));
        renderFavs();
        document.getElementById('favInput').value = "";
    }
}

function loadFav(city) {
    document.getElementById('cityInput').value = city;
    toggleFavorites(); // Close menu
    getWeather();
}