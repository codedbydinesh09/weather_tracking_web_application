"""
Geocoding Service — Handles OpenStreetMap Nominatim API interactions for city search.
"""

import requests

NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"

def search_cities(query, limit=7):
    """
    Search for cities using OpenStreetMap Nominatim Geocoding API.
    Returns a list of city result dicts.
    """
    url = f"{NOMINATIM_BASE_URL}/search"
    headers = {
    "User-Agent": "WeatherProRouteApp/1.0 (Contact: dikssh85@gmail.com)"
}
    params = {
        'q': query,
        'format': 'json',
        'addressdetails': 1,
        'limit': limit,
        
    }
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)

        print("STATUS CODE:", resp.status_code)
        print("RESPONSE TEXT:", resp.text[:500])

        data = resp.json()

        results = []
        if isinstance(data, list):
            for item in data:
                address = item.get('address', {})
                name = address.get('city') or address.get('town') or address.get('village') or item.get('name')
                
                # Only include valid names
                if not name:
                    continue
                    
                results.append({
                    'name': name,
                    'state': address.get('state', ''),
                    'country': address.get('country', ''),
                    'lat': float(item.get('lat')),
                    'lon': float(item.get('lon')),
                })
        return results
    except Exception as e:
        print(f"Nominatim Geocoding Error: {e}")
        return []
