document.addEventListener('DOMContentLoaded', () => {

    let globe = null;
    let searchTimeout = null;
    
    const globeEl = document.getElementById('globeViz');
    const searchBox = document.getElementById('globeSearchBox');
    const suggestions = document.getElementById('globeSuggestions');
    const weatherPanel = document.getElementById('weatherPanel');
    const wpContent = document.getElementById('wpContent');

    window.closeWeatherPanel = function() {
        if (weatherPanel) {
            weatherPanel.classList.add('hidden-panel');
            weatherPanel.classList.remove('open');
        }
        const layout = document.querySelector('.dashboard-layout');
        if (layout) {
            layout.classList.remove('panel-open');
        }
    };

    // 1. GLOBE INIT
    if (globeEl) {
        globe = Globe()
            (globeEl)
            .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
            .backgroundColor('rgba(0,0,0,0)')
            .pointOfView({ lat: 20, lng: 0, altitude: 2 });
            
        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 1.5;
        
        // Resize listener
        window.addEventListener('resize', () => {
            globe.width(globeEl.clientWidth);
            globe.height(globeEl.clientHeight);
        });
    }

    // 2. AUTOCOMPLETE
    if (searchBox) {
        searchBox.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const val = e.target.value.trim();
            
            if (val.length < 2) {
                suggestions.style.display = 'none';
                return;
            }
            
            searchTimeout = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/city-search/?q=${encodeURIComponent(val)}`);
                    const data = await res.json();
                    
                    suggestions.innerHTML = '';
                    if (data.results && data.results.length > 0) {
                        data.results.forEach(city => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.innerHTML = `<strong>${city.name}</strong> <small>${city.country}</small>`;
                            div.onclick = () => selectCity(city.name, city.lat, city.lon);
                            suggestions.appendChild(div);
                        });
                        suggestions.style.display = 'block';
                    } else {
                        suggestions.style.display = 'none';
                    }
                } catch (err) {
                    console.error('Search error:', err);
                }
            }, 300);
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchBox.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
            }
        });
    }

    // 3. FETCH & RENDER WEATHER
    async function selectCity(cityName, lat, lon) {
        searchBox.value = cityName;
        suggestions.style.display = 'none';
        
        // Fly to location on globe
        if (globe && lat !== undefined && lon !== undefined) {
            globe.pointOfView({ lat: lat, lng: lon, altitude: 1.5 }, 1500);
            
            // Add a ring/marker
            globe.ringsData([{ lat: lat, lng: lon, color: '#38BDF8' }])
                 .ringColor('color')
                 .ringMaxRadius(5)
                 .ringPropagationSpeed(3)
                 .ringRepeatPeriod(700);
        }

        try {
            // Wait a bit for the globe animation
            wpContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #fff;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching weather for ${cityName}...</div>`;
            weatherPanel.classList.remove('hidden-panel');
            weatherPanel.classList.add('open');
            document.querySelector('.dashboard-layout').classList.add('panel-open');

            const res = await fetch(`/api/weather/?city=${encodeURIComponent(cityName)}`);
            const data = await res.json();
            
            if (data.error) {
                wpContent.innerHTML = `<div style="padding: 20px; color: #ef4444;">${data.error}</div>`;
                return;
            }
            
            const temp = Math.round(data.temperature);
            const iconUrl = data.icon ? `https://openweathermap.org/img/wn/${data.icon}@2x.png` : '';
            const latStr = (data.lat !== undefined ? data.lat : lat).toFixed(2);
            const lonStr = (data.lon !== undefined ? data.lon : lon).toFixed(2);
            
            wpContent.innerHTML = `
                <div style="font-size: 1.8rem; font-weight: 700; color: #fff; margin-bottom: 4px;">${data.city}</div>
                <div style="font-size: 0.8rem; color: #38bdf8; font-weight: 600; display: flex; align-items: center; gap: 6px; margin-bottom: 24px;">
                    <span style="display:inline-block; width:8px; height:8px; background:#38bdf8; border-radius:50%; animation: pulse 2s infinite;"></span>
                    Live Weather Tracking
                </div>

                <div style="background: rgba(255, 255, 255, 0.05); border-radius: 20px; padding: 24px; margin-bottom: 16px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-size: 3.5rem; font-weight: 800; color: #fff; line-height: 1;">${temp}°C</div>
                        ${iconUrl ? `<img src="${iconUrl}" width="70" height="70" alt="weather icon" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">` : ''}
                    </div>
                    <div style="font-size: 1rem; color: #cbd5e1; text-transform: capitalize; font-weight: 500;">${data.description}</div>
                </div>

                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <div style="flex: 1; background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem; color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <i class="fa-regular fa-calendar"></i> ${data.date}
                    </div>
                    <div style="flex: 1; background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem; color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <i class="fa-regular fa-clock"></i> ${data.time}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 16px 10px; border-radius: 16px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <div style="color: #94a3b8; font-size: 0.75rem; margin-bottom: 8px; text-transform: uppercase; font-weight: 600;"><i class="fa-solid fa-droplet"></i> Humidity</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">${data.humidity}%</div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 16px 10px; border-radius: 16px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <div style="color: #94a3b8; font-size: 0.75rem; margin-bottom: 8px; text-transform: uppercase; font-weight: 600;"><i class="fa-solid fa-wind"></i> Wind</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">${data.wind_speed}<span style="font-size: 0.7rem; font-weight:normal;">m/s</span></div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.05); padding: 16px 10px; border-radius: 16px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);">
                        <div style="color: #94a3b8; font-size: 0.75rem; margin-bottom: 8px; text-transform: uppercase; font-weight: 600;"><i class="fa-solid fa-gauge"></i> Pressure</div>
                        <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">${data.pressure}<span style="font-size: 0.7rem; font-weight:normal;">hPa</span></div>
                    </div>
                </div>

                <div style="text-align: center; color: #64748b; font-size: 0.85rem; margin-bottom: 24px;">
                    <i class="fa-solid fa-location-dot"></i> ${latStr}° N, ${lonStr}° E
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
                    <button class="panel-chip" onclick="document.getElementById('globeSearchBox').value='London'; document.getElementById('globeSearchBox').dispatchEvent(new Event('input', { bubbles: true }));"><i class="fa-solid fa-city"></i> London</button>
                    <button class="panel-chip" onclick="document.getElementById('globeSearchBox').value='Tokyo'; document.getElementById('globeSearchBox').dispatchEvent(new Event('input', { bubbles: true }));"><i class="fa-solid fa-torii-gate"></i> Tokyo</button>
                    <button class="panel-chip" onclick="document.getElementById('globeSearchBox').value='New York'; document.getElementById('globeSearchBox').dispatchEvent(new Event('input', { bubbles: true }));"><i class="fa-solid fa-building"></i> New York</button>
                    <button class="panel-chip" onclick="document.getElementById('globeSearchBox').value='Paris'; document.getElementById('globeSearchBox').dispatchEvent(new Event('input', { bubbles: true }));"><i class="fa-solid fa-monument"></i> Paris</button>
                    <button class="panel-chip" onclick="document.getElementById('globeSearchBox').value='Dubai'; document.getElementById('globeSearchBox').dispatchEvent(new Event('input', { bubbles: true }));"><i class="fa-solid fa-building"></i> Dubai</button>
                    <button class="panel-chip" onclick="document.getElementById('globeSearchBox').value='Mumbai'; document.getElementById('globeSearchBox').dispatchEvent(new Event('input', { bubbles: true }));"><i class="fa-solid fa-om"></i> Mumbai</button>
                </div>
            `;
            
        } catch (err) {
            wpContent.innerHTML = `<div style="padding: 20px; color: var(--accent-coral);">Failed to load weather data.</div>`;
            console.error(err);
        }
    }
    
    // Auto-select for quick chips
    window.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'globeSearchBox' && e.isTrusted === false) {
            // Triggered by quick chip click
            setTimeout(() => {
                const val = e.target.value;
                if(val) selectCity(val);
            }, 50);
        }
    });
});
