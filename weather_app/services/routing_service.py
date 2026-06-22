"""
Routing Service — Handles OSRM API interactions for route generation.
"""

import requests
import math


OSRM_BASE_URL = "https://router.project-osrm.org"


def fetch_shortest_route(start_lat, start_lon, end_lat, end_lon, timeout=15):
    """
    Fetch the shortest driving route between two points using OSRM.
    Returns a dict with route info or None on failure.
    """
    url = (
        f"{OSRM_BASE_URL}/route/v1/driving/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}"
        f"?overview=full&geometries=geojson&steps=true"
    )
    try:
        resp = requests.get(url, timeout=timeout)
        data = resp.json()

        if data.get('code') != 'Ok' or not data.get('routes'):
            return None

        route = data['routes'][0]

        return {
            'distance': route['distance'],
            'duration': route['duration'],
            'geometry': route['geometry'],
            'summary': _build_route_summary(route),
        }
    except Exception:
        return None


def _build_route_summary(route):
    """Build a human-readable route summary from OSRM steps."""
    try:
        legs = route.get('legs', [])
        if legs:
            summary = legs[0].get('summary', '')
            if summary:
                return summary
    except Exception:
        pass
    return 'Calculated Route'

def sample_checkpoints(coordinates):
    """
    Sample exactly 5 checkpoints from the route:
    Start, 25%, 50%, 75%, Destination
    """
    total = len(coordinates)

    if total == 0:
        return []

    if total < 5:
        return [
            {'lon': c[0], 'lat': c[1]}
            for c in coordinates
        ]

    checkpoint_indexes = [
        0,
        int(total * 0.25),
        int(total * 0.50),
        int(total * 0.75),
        total - 1
    ]

    return [
        {'lon': coordinates[idx][0], 'lat': coordinates[idx][1]}
        for idx in checkpoint_indexes
    ]

def get_midpoint(coordinates):
    """Get the geographical midpoint of a route's coordinates."""
    if not coordinates:
        return None
    mid_index = len(coordinates) // 2
    return {
        'lon': coordinates[mid_index][0],
        'lat': coordinates[mid_index][1],
    }
