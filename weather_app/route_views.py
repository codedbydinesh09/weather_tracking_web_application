"""
Route Views — Dedicated API endpoints for the Route Weather Forecast module.
Clean architecture implementation.
"""

from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

from .services.weather_service import (
    fetch_weather_for_checkpoints,
    fetch_forecast_by_coords,
)
from .services.routing_service import (
    fetch_shortest_route,
    sample_checkpoints,
)
from .services.geocoding_service import search_cities

@login_required(login_url='login')
def api_route_generate(request):
    """
    Generate a complete route with weather data.
    Expects GET params: start_lat, start_lon, end_lat, end_lon
    """
    start_lat = request.GET.get('start_lat', '').strip()
    start_lon = request.GET.get('start_lon', '').strip()
    end_lat = request.GET.get('end_lat', '').strip()
    end_lon = request.GET.get('end_lon', '').strip()

    if not all([start_lat, start_lon, end_lat, end_lon]):
        return JsonResponse({'error': 'Coordinates for both cities are required.'}, status=400)

    try:
        s_lat = float(start_lat)
        s_lon = float(start_lon)
        e_lat = float(end_lat)
        e_lon = float(end_lon)
    except ValueError:
        return JsonResponse({'error': 'Invalid coordinate values.'}, status=400)

    # 1. Fetch route from OSRM
    route_data = fetch_shortest_route(s_lat, s_lon, e_lat, e_lon)
    if not route_data:
        return JsonResponse(
            {'error': 'Could not find a driving route between these locations.'},
            status=404
        )

    # 2. Sample 3 checkpoints (start, mid, end)
    coordinates = route_data['geometry']['coordinates']
    checkpoints = sample_checkpoints(coordinates)

    # 3. Fetch weather for each checkpoint
    weather_data = fetch_weather_for_checkpoints(checkpoints)
    if not weather_data:
        return JsonResponse(
            {'error': 'Failed to fetch weather data for the route.'},
            status=503
        )

    # 4. Fetch forecast for start and destination
    start_forecast = fetch_forecast_by_coords(s_lat, s_lon)
    end_forecast = fetch_forecast_by_coords(e_lat, e_lon)

    # 5. Build response
    return JsonResponse({
        'route': {
            'distance': route_data['distance'],
            'duration': route_data['duration'],
            'geometry': route_data['geometry'],
            'summary': route_data['summary'],
        },
        'weather': weather_data,
        'forecasts': {
            'start': start_forecast,
            'destination': end_forecast,
        }
    })

@login_required(login_url='login')
def api_route_city_search(request):
    """
    Search for cities by name using Nominatim API.
    Expects GET param: q (query string)
    """
    query = request.GET.get('q', '').strip()
    if not query or len(query) < 2:
        return JsonResponse({'results': []})

    results = search_cities(query, limit=7)
    return JsonResponse({'results': results})
