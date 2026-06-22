/* Route Weather JS */

document.addEventListener('DOMContentLoaded', () => {
    RouteWeather.init();
});

const RouteWeather = (() => {
    let map = null;
    let polyline = null;
    let markers = [];
    let startCoords = null;
    let endCoords = null;

    function init() {
        // Init Map
        map = L.map('map').setView([20.5937, 78.9629], 5); // Default to India
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Attach autocomplete to the new .city-input-wrapper divs
        setupAutocomplete('startLocation', (city) => { startCoords = { lat: city.lat, lon: city.lon }; });
        setupAutocomplete('endLocation',   (city) => { endCoords   = { lat: city.lat, lon: city.lon }; });

        window.planRoute      = planRoute;
        window.swapLocations  = swapLocations;
        window.setQuickRoute  = setQuickRoute;
    }

    // ── Autocomplete ──────────────────────────────────────────────────────────
    function setupAutocomplete(inputId, onSelect) {
        const input = document.getElementById(inputId);
        // The input is now inside a .city-input-wrapper — use that as the anchor
        const wrapper = input.closest('.city-input-wrapper') || input.parentElement;

        const list = document.createElement('ul');
        list.className = 'suggestions-list hidden';
        wrapper.appendChild(list);

        let timeout = null;

        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const val = e.target.value.trim();
            if (val.length < 2) {
                list.classList.add('hidden');
                return;
            }
            timeout = setTimeout(async () => {
                try {
                    // Use the same city-search API as the dashboard
                    const res  = await fetch(`/api/route/city-search/?q=${encodeURIComponent(val)}`);
                    const data = await res.json();
                    list.innerHTML = '';

                    if (data.results && data.results.length > 0) {
                        data.results.forEach(city => {
                            const li = document.createElement('li');
                            li.innerHTML = `<strong>${city.name}</strong><small>${city.country}</small>`;
                            li.addEventListener('click', () => {
                                input.value = city.name;
                                onSelect(city);
                                list.classList.add('hidden');
                            });
                            list.appendChild(li);
                        });
                        list.classList.remove('hidden');
                    } else {
                        list.classList.add('hidden');
                    }
                } catch (err) {
                    console.error('City search error:', err);
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                list.classList.add('hidden');
            }
        });
    }

    // ── Swap ──────────────────────────────────────────────────────────────────
    function swapLocations() {
        const startInput = document.getElementById('startLocation');
        const endInput   = document.getElementById('endLocation');
        const tempVal    = startInput.value;
        startInput.value = endInput.value;
        endInput.value   = tempVal;

        const tempCoords = startCoords;
        startCoords = endCoords;
        endCoords   = tempCoords;
    }

    // ── Quick Routes ──────────────────────────────────────────────────────────
    async function setQuickRoute(start, end) {
        document.getElementById('startLocation').value = start;
        document.getElementById('endLocation').value   = end;

        const planBtn = document.getElementById('planRouteBtn');
        if (planBtn) {
            planBtn.disabled = true;
            planBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        }

        try {
            showToast('Fetching route…', 'info');
            const [res1, res2] = await Promise.all([
                fetch(`/api/route/city-search/?q=${encodeURIComponent(start)}`),
                fetch(`/api/route/city-search/?q=${encodeURIComponent(end)}`)
            ]);
            const d1 = await res1.json();
            const d2 = await res2.json();

            if (d1.results.length && d2.results.length) {
                startCoords = { lat: d1.results[0].lat, lon: d1.results[0].lon };
                endCoords   = { lat: d2.results[0].lat, lon: d2.results[0].lon };
                planRoute();
            } else {
                showToast('Could not find one of the cities', 'error');
                if (planBtn) {
                    planBtn.disabled = false;
                    planBtn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Plan Route';
                }
            }
        } catch (e) {
            showToast('Failed to auto-route', 'error');
            if (planBtn) {
                planBtn.disabled = false;
                planBtn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Plan Route';
            }
        }
    }

    // ── Plan Route ────────────────────────────────────────────────────────────
    async function planRoute() {
        if (!startCoords || !endCoords) {
            showToast('Please select valid start and destination cities from the dropdown', 'warning');
            return;
        }

        showToast('Planning route and fetching weather…', 'info');

        const planBtn = document.getElementById('planRouteBtn');
        if (planBtn) {
            planBtn.disabled = true;
            planBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        }

        try {
            const url = `/api/route/generate/?start_lat=${startCoords.lat}&start_lon=${startCoords.lon}&end_lat=${endCoords.lat}&end_lon=${endCoords.lon}`;
            const res  = await fetch(url);
            if (!res.ok) throw new Error('Route API failed');
            const data = await res.json();

            drawRouteOnMap(data.route, data.weather);
            renderCheckpoints(data.weather);
            renderForecasts(
                data.forecasts,
                document.getElementById('startLocation').value,
                document.getElementById('endLocation').value
            );

            // Distance badge
            document.getElementById('distanceBadge').classList.remove('hidden');
            document.getElementById('totalDistance').innerText = (data.route.distance / 1000).toFixed(1);

            // Reveal sections
            document.getElementById('routeMapSection').classList.remove('hidden');
            document.getElementById('routeWeatherSection').classList.remove('hidden');
            document.getElementById('routeForecastSection').classList.remove('hidden');

            showToast('Route generated successfully!', 'success');

            // Fix Leaflet rendering glitch after un-hiding and recalculate bounds
            setTimeout(() => { 
                map.invalidateSize(); 
                if (polyline) {
                    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
                }
            }, 300);

        } catch (e) {
            console.error(e);
            showToast(e.message || 'Failed to generate route', 'error');
        } finally {
            if (planBtn) {
                planBtn.disabled = false;
                planBtn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Plan Route';
            }
        }
    }

    // ── Map Drawing ───────────────────────────────────────────────────────────
    function drawRouteOnMap(route, checkpointsData) {
        if (polyline) map.removeLayer(polyline);
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        // GeoJSON uses [lon, lat] → Leaflet needs [lat, lon]
        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        polyline = L.polyline(coords, { color: '#38BDF8', weight: 5, opacity: 0.8 }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

        if (checkpointsData && checkpointsData.length > 0) {
            checkpointsData.forEach((point, i) => {
                let label = `Checkpoint ${i + 1}`;
                if (i === 0) label = 'Start';
                else if (i === checkpointsData.length - 1) label = 'Destination';
                else if (i === Math.floor(checkpointsData.length / 2)) label = 'Midpoint';

                markers.push(L.marker([point.lat, point.lon]).addTo(map).bindPopup(`${label}: ${point.city}`));
            });
        } else {
            markers.push(L.marker(coords[0]).addTo(map).bindPopup('Start'));
            markers.push(L.marker(coords[coords.length - 1]).addTo(map).bindPopup('Destination'));
        }
    }

    // ── Checkpoint Cards ──────────────────────────────────────────────────────
    function renderCheckpoints(weatherData) {
        const container = document.getElementById('weatherCheckpoints');
        container.innerHTML = '';

        const labels = ['START', 'CHECKPOINT 1', 'MIDPOINT', 'CHECKPOINT 2', 'DESTINATION'];
        const badgeClasses = ['start', 'mid', 'mid', 'mid', 'dest'];

        weatherData.forEach((point, i) => {
            const badgeClass = badgeClasses[i] || 'mid';
            const badgeText  = labels[i]       || `CHECKPOINT ${i + 1}`;

            const temp      = point.temperature !== undefined ? Math.round(point.temperature) + '°C' : '--°C';
            const condition = point.description || point.weather_main || 'Unknown';
            const iconUrl   = point.icon ? `https://openweathermap.org/img/wn/${point.icon}@2x.png` : '';

            const card = document.createElement('div');
            card.className = 'glass-card checkpoint-card';
            card.innerHTML = `
                <div class="cp-header">
                    <span class="cp-badge ${badgeClass}">${badgeText}</span>
                    <span class="cp-city">${point.city || `Point ${i + 1}`}</span>
                </div>
                <div class="cp-weather">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${iconUrl ? `<img src="${iconUrl}" alt="${condition}" width="54">` : ''}
                        <div style="font-size:1rem; text-transform:capitalize; font-weight:600;">${condition}</div>
                    </div>
                    <div class="cp-temp">${temp}</div>
                </div>
                <div class="cp-stats">
                    <span><i class="fa-solid fa-wind"></i> ${point.wind_speed || 0} m/s</span>
                    <span><i class="fa-solid fa-droplet"></i> ${point.humidity || 0}%</span>
                    <span><i class="fa-solid fa-gauge"></i> ${point.pressure || '--'} hPa</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // ── Forecast Accordions ───────────────────────────────────────────────────
    function renderForecasts(forecasts, startName, endName) {
        const container = document.getElementById('rwForecastContent');
        container.innerHTML = '';

        const createAccordion = (title, data) => {
            if (!data || !Array.isArray(data) || data.length === 0) return '';

            let cardsHtml = '';
            for (let i = 0; i < Math.min(5, data.length); i++) {
                const f = data[i];
                // dt_txt is e.g. "2023-10-25 15:00:00"
                const dateObj = new Date(f.dt_txt.replace(/-/g, '/'));
                const date = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const temp = Math.round(f.temp);
                const rain = f.rain_prob || 0;

                cardsHtml += `
                    <div class="forecast-card">
                        <div style="font-weight:600; font-size:0.85rem;">${date}</div>
                        <div style="font-size:1.5rem; font-weight:700; color:var(--accent-blue);">
                            ${temp}°
                        </div>
                        <div style="font-size:0.8rem; color:#cbd5e1;">
                            <i class="fa-solid fa-cloud-rain"></i> ${Math.round(rain)}%
                        </div>
                    </div>
                `;
            }

            return `
                <div class="accordion open">
                    <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
                        <span><i class="fa-solid fa-location-dot" style="color:var(--accent-coral);"></i> ${title} — Forecast</span>
                        <i class="fa-solid fa-chevron-down accordion-icon" style="transition:transform 0.3s;"></i>
                    </div>
                    <div class="accordion-content">
                        <div class="forecast-row">${cardsHtml}</div>
                    </div>
                </div>
            `;
        };

        container.innerHTML =
            createAccordion(startName, forecasts.start) +
            createAccordion(endName,   forecasts.destination);
    }

    return { init };
})();
