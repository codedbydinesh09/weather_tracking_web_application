"""
Weather Service — Handles all OpenWeatherMap API interactions for the route module.
"""

import requests
from django.conf import settings

OPENWEATHER_API_KEY = settings.OPENWEATHER_API_KEY


def fetch_weather_by_coords(lat, lon, timeout=10):
    """
    Fetch current weather data for given coordinates.
    Returns a dict with weather info or None on failure.
    """
    url = (
        f"http://api.openweathermap.org/data/2.5/weather"
        f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    )
    try:
        resp = requests.get(url, timeout=timeout)
        data = resp.json()

        if data.get('cod') != 200:
            return None

        return {
            'city': data.get('name', 'Unknown'),
            'temperature': data['main']['temp'],
            'feels_like': data['main'].get('feels_like'),
            'humidity': data['main']['humidity'],
            'pressure': data['main']['pressure'],
            'wind_speed': data['wind']['speed'],
            'wind_deg': data['wind'].get('deg', 0),
            'visibility': data.get('visibility', 10000),
            'description': data['weather'][0]['description'],
            'icon': data['weather'][0]['icon'],
            'weather_main': data['weather'][0]['main'],
            'clouds': data.get('clouds', {}).get('all', 0),
            'rain_1h': data.get('rain', {}).get('1h', 0),
            'lat': data['coord']['lat'],
            'lon': data['coord']['lon'],
        }
    except Exception:
        return None


def fetch_forecast_by_coords(lat, lon, timeout=10):
    """
    Fetch 5-day / 3-hour forecast for given coordinates.
    Returns a list of forecast entries or None on failure.
    """
    url = (
        f"http://api.openweathermap.org/data/2.5/forecast"
        f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    )
    try:
        resp = requests.get(url, timeout=timeout)
        data = resp.json()

        if data.get('cod') != '200':
            return None

        forecasts = []
        for item in data.get('list', [])[:8]:
            forecasts.append({
                'dt_txt': item.get('dt_txt'),
                'temp': item['main']['temp'],
                'humidity': item['main']['humidity'],
                'wind_speed': item['wind']['speed'],
                'description': item['weather'][0]['description'],
                'icon': item['weather'][0]['icon'],
                'weather_main': item['weather'][0]['main'],
                'rain_prob': item.get('pop', 0) * 100,
                'visibility': item.get('visibility', 10000),
            })
        return forecasts
    except Exception:
        return None


def fetch_weather_for_checkpoints(checkpoints):
    """
    Fetch current weather for a list of checkpoint dicts [{lat, lon}, ...].
    Returns a list of weather data dicts (skips failures).
    """
    results = []
    for cp in checkpoints:
        weather = fetch_weather_by_coords(cp['lat'], cp['lon'])
        if weather:
            results.append(weather)
    return results



