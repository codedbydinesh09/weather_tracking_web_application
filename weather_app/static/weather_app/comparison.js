document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.color = '#7DA0CA';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.borderColor = 'rgba(193,232,255,0.15)';

    setupCityAutocomplete('cityA', 'cityASuggestions');
    setupCityAutocomplete('cityB', 'cityBSuggestions');
});

let comparisonChart = null;
let cityAData = [];
let cityBData = [];
let availableTimes = [];

function setupCityAutocomplete(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
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
                const res = await fetch(`/api/city-search/?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                
                list.innerHTML = '';
                if (data.results && data.results.length > 0) {
                    data.results.forEach(city => {
                        const li = document.createElement('li');
                        li.innerHTML = `<strong>${city.name}</strong> <small>${city.country}</small>`;
                        li.onclick = () => {
                            input.value = city.name;
                            list.classList.add('hidden');
                        };
                        list.appendChild(li);
                    });
                    list.classList.remove('hidden');
                } else {
                    list.classList.add('hidden');
                }
            } catch (err) {
                console.error(err);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !list.contains(e.target)) {
            list.classList.add('hidden');
        }
    });
}

async function fetchComparisonData() {
    const cityA = document.getElementById('cityA').value.trim();
    const cityB = document.getElementById('cityB').value.trim();

    if (!cityA || !cityB) {
        alert("Please select both City A and City B");
        return;
    }

    try {
        const [resA, resB] = await Promise.all([
            fetch(`/api/forecast/?city=${encodeURIComponent(cityA)}`),
            fetch(`/api/forecast/?city=${encodeURIComponent(cityB)}`)
        ]);

        const dataA = await resA.json();
        const dataB = await resB.json();

        if (dataA.error || dataB.error) {
            alert(dataA.error || dataB.error);
            return;
        }

        cityAData = dataA.forecast;
        cityBData = dataB.forecast;
        
        // Extract available times from cityA (assume they align closely enough)
        availableTimes = cityAData.map(d => d.dt_txt);
        
        populateDateDropdowns();
        updateChart();

    } catch (err) {
        console.error(err);
        alert("Failed to fetch comparison data.");
    }
}

function populateDateDropdowns() {
    const startSelect = document.getElementById('startDateTime');
    const endSelect = document.getElementById('endDateTime');
    
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';
    
    availableTimes.forEach((time, index) => {
        const d = new Date(time).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
        
        const optStart = document.createElement('option');
        optStart.value = index;
        optStart.text = d;
        startSelect.appendChild(optStart);
        
        const optEnd = document.createElement('option');
        optEnd.value = index;
        optEnd.text = d;
        endSelect.appendChild(optEnd);
    });
    
    // Default select end to the last item
    endSelect.value = availableTimes.length - 1;
}

window.updateChart = function() {
    if (cityAData.length === 0 || cityBData.length === 0) return;

    const param = document.getElementById('parameterSelect').value;
    const startIndex = parseInt(document.getElementById('startDateTime').value || 0);
    const endIndex = parseInt(document.getElementById('endDateTime').value || availableTimes.length - 1);
    
    if (startIndex > endIndex) {
        alert("Start Date cannot be after End Date.");
        return;
    }

    const filteredLabels = availableTimes.slice(startIndex, endIndex + 1).map(t => new Date(t).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit'}));
    const filteredA = cityAData.slice(startIndex, endIndex + 1).map(d => d[param]);
    const filteredB = cityBData.slice(startIndex, endIndex + 1).map(d => d[param]);

    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    if (comparisonChart) {
        comparisonChart.destroy();
    }

    // Gradients for blue palette theme
    const gradientA = ctx.createLinearGradient(0, 0, 0, 400);
    gradientA.addColorStop(0, 'rgba(193, 232, 255, 0.3)');
    gradientA.addColorStop(1, 'rgba(193, 232, 255, 0.0)');

    const gradientB = ctx.createLinearGradient(0, 0, 0, 400);
    gradientB.addColorStop(0, 'rgba(125, 160, 202, 0.3)');
    gradientB.addColorStop(1, 'rgba(125, 160, 202, 0.0)');

    comparisonChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: filteredLabels,
            datasets: [
                {
                    label: document.getElementById('cityA').value,
                    data: filteredA,
                    borderColor: '#C1E8FF',
                    backgroundColor: gradientA,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#021024',
                    pointBorderColor: '#C1E8FF',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: document.getElementById('cityB').value,
                    data: filteredB,
                    borderColor: '#7DA0CA',
                    backgroundColor: gradientB,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#021024',
                    pointBorderColor: '#7DA0CA',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#021024',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    borderColor: 'rgba(193,232,255,0.25)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    grid: { color: 'rgba(193,232,255,0.15)' }
                }
            }
        }
    });
};
