import json
import requests
from datetime import datetime, timedelta
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.conf import settings
from .models import City, UserLocation, ChatSession, ChatMessage
import google.generativeai as genai

OPENWEATHER_API_KEY = settings.OPENWEATHER_API_KEY
GEMINI_API_KEY = settings.GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

# ─── API Configuration ───────────────────────────────────────────────

WEATHER_SYSTEM_INSTRUCTION = (
    "You are a specialized AI Weather Assistant for the WeatherPro application. "
    "Answer ONLY weather-related questions (weather, climate, forecasts, routes, atmosphere). "
    "If the question is unrelated, politely refuse."
)

def get_weather_for_city(city):
    try:
        url = (
            f"http://api.openweathermap.org/data/2.5/weather"
            f"?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"
        )

        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get("cod") != 200:
            return None

        return {
            "city": data["name"],
            "temperature": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "pressure": data["main"]["pressure"],
            "wind_speed": data["wind"]["speed"],
            "description": data["weather"][0]["description"]
        }

    except Exception:
        return None

def get_city_coords(city):
    """Get latitude and longitude for a city using OpenWeatherMap geocoding."""
    try:
        url = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit=1&appid={OPENWEATHER_API_KEY}"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if data and len(data) > 0:
            return data[0].get('lat'), data[0].get('lon')
        return None, None
    except Exception:
        return None, None
    

def get_historical_weather(city, days_ago):
    """
    Fetch daily historical weather for a given city and number of days ago.
    Returns a dict with date, max_temp, min_temp, precipitation, or None.
    """
    lat, lon = get_city_coords(city)
    if lat is None or lon is None:
        return None

    target_date = datetime.now().date() - timedelta(days=days_ago)
    date_str = target_date.strftime('%Y-%m-%d')

    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={date_str}&end_date={date_str}"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
        f"&timezone=auto"
    )

    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        daily = data.get('daily', {})
        if daily and daily.get('temperature_2m_max'):
            return {
                'city': city,
                'date': date_str,
                'max_temp': daily['temperature_2m_max'][0],
                'min_temp': daily['temperature_2m_min'][0],
                'precipitation': daily['precipitation_sum'][0],
            }
        return None
    except Exception:
        return None

def get_forecast_for_city(city):
    try:
        url = (
            f"http://api.openweathermap.org/data/2.5/forecast"
            f"?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"
        )

        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get("cod") != "200":
            return None

        forecast = data["list"][8]

        return {
            "city": city,
            "temperature": forecast["main"]["temp"],
            "humidity": forecast["main"]["humidity"],
            "pressure": forecast["main"]["pressure"],
            "wind_speed": forecast["wind"]["speed"],
            "description": forecast["weather"][0]["description"]
        }

    except Exception:
        return None

# ─── Authentication Views ────────────────────────────────────────────

def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')

        try:
            user = User.objects.get(email=email)
            user = authenticate(request, username=user.username, password=password)

            if user:
                auth_login(request, user)
                return redirect('dashboard')
            else:
                return render(request, 'weather_app/login.html', {'error': 'Invalid password.'})

        except User.DoesNotExist:
            return render(request, 'weather_app/login.html', {'error': 'No account found with this email.'})

    return render(request, 'weather_app/login.html')


def register_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')

        if not email or not password:
            return render(request, 'weather_app/register.html', {'error': 'Email and password are required.'})

        if User.objects.filter(email=email).exists():
            return render(request, 'weather_app/register.html', {'error': 'Email already exists.'})

        base_username = email.split('@')[0]
        username = base_username
        counter = 1

        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        User.objects.create_user(username=username, email=email, password=password)
        return redirect('login')

    return render(request, 'weather_app/register.html')


def logout_view(request):
    auth_logout(request)
    return redirect('login')


# ─── Page Views ──────────────────────────────────────────────────────

@login_required(login_url='login')
def dashboard(request):
    return render(request, 'weather_app/dashboard.html')


@login_required(login_url='login')
def comparison(request):
    return render(request, 'weather_app/comparison.html')


@login_required(login_url='login')
def route_weather(request):
    return render(request, 'weather_app/route_weather.html')


@login_required(login_url='login')
def chatbot(request):
    return render(request, 'weather_app/chatbot.html')


@login_required(login_url='login')
def profile(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            username = data.get('username', '').strip()
            email = data.get('email', '').strip()
            password = data.get('password', '')

            user = request.user

            if email and email != user.email and User.objects.filter(email=email).exclude(id=user.id).exists():
                return JsonResponse({'error': 'Email already in use.'}, status=400)

            if username and username != user.username and User.objects.filter(username=username).exclude(id=user.id).exists():
                return JsonResponse({'error': 'Username already taken.'}, status=400)

            if username:
                user.username = username
            if email:
                user.email = email
            if password:
                user.set_password(password)

            user.save()

            if password:
                update_session_auth_hash(request, user)

            return JsonResponse({'success': True, 'message': 'Profile updated successfully'})

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return render(request, 'weather_app/profile.html', {'user': request.user})


# ─── Weather APIs ────────────────────────────────────────────────────

@login_required(login_url='login')
def api_weather(request):
    city = request.GET.get('city', '').strip()
    if not city:
        return JsonResponse({'error': 'City required'}, status=400)

    url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"

    try:
        data = requests.get(url, timeout=10).json()
    except:
        return JsonResponse({'error': 'Weather service unavailable'}, status=503)

    if data.get('cod') != 200:
        return JsonResponse({'error': 'City not found'}, status=404)

    # Get timezone offset from API
    timezone_offset = data.get('timezone', 0)

    # Current UTC time
    utc_time = datetime.utcnow()

    # Convert to local city time
    city_time = utc_time + timedelta(seconds=timezone_offset)

    # Format date and time
    formatted_date = city_time.strftime('%d %B %Y')
    formatted_time = city_time.strftime('%I:%M %p')

    return JsonResponse({
        'city': data.get('name'),
        'temperature': data.get('main', {}).get('temp'),
        'description': data['weather'][0]['description'],
        'icon': data['weather'][0]['icon'],
        'humidity': data.get('main', {}).get('humidity'),
        'wind_speed': data.get('wind', {}).get('speed'),
        'pressure': data.get('main', {}).get('pressure'),
        'lat': data.get('coord', {}).get('lat'),
        'lon': data.get('coord', {}).get('lon'),
        'date': formatted_date,
        'time': formatted_time,
    })

@login_required(login_url='login')
def api_weather_coords(request):
    lat = request.GET.get('lat', '').strip()
    lon = request.GET.get('lon', '').strip()

    if not lat or not lon:
        return JsonResponse({'error': 'Coordinates required'}, status=400)

    url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"

    try:
        data = requests.get(url, timeout=10).json()
    except:
        return JsonResponse({'error': 'Weather service unavailable'}, status=503)

    if data.get('cod') != 200:
        return JsonResponse({'error': 'Weather not found'}, status=404)
    
    # Get timezone offset from API
    timezone_offset = data.get('timezone', 0)

    # Current UTC time
    utc_time = datetime.utcnow()

    # Convert to local city time
    city_time = utc_time + timedelta(seconds=timezone_offset)

    # Format date and time
    formatted_date = city_time.strftime('%d %B %Y')
    formatted_time = city_time.strftime('%I:%M %p')

    return JsonResponse({
        'city': data.get('name', 'Unknown'),
        'temperature': data.get('main', {}).get('temp'),
        'description': data['weather'][0]['description'],
        'icon': data['weather'][0]['icon'],
        'humidity': data.get('main', {}).get('humidity'),
        'wind_speed': data.get('wind', {}).get('speed'),
        'pressure': data.get('main', {}).get('pressure'),
        'lat': data.get('coord', {}).get('lat'),
        'lon': data.get('coord', {}).get('lon'),
        'date': formatted_date,
        'time': formatted_time,
    })


# ─── CHATBOT API (OPENROUTER FINAL VERSION) ──────────────────────────

@login_required(login_url='login')
def api_forecast(request):
    city = request.GET.get('city', '').strip()
    if not city:
        return JsonResponse({'error': 'City required'}, status=400)

    url = f"http://api.openweathermap.org/data/2.5/forecast?q={city}&appid={OPENWEATHER_API_KEY}&units=metric"
    try:
        data = requests.get(url, timeout=10).json()
    except:
        return JsonResponse({'error': 'Weather service unavailable'}, status=503)

    if data.get('cod') != "200":
        return JsonResponse({'error': 'City not found'}, status=404)

    forecast_data = []
    for item in data.get('list', [])[:8]:
        forecast_data.append({
            'dt_txt': item.get('dt_txt'),
            'temp': item.get('main', {}).get('temp'),
            'humidity': item.get('main', {}).get('humidity'),
            'wind_speed': item.get('wind', {}).get('speed'),
            'pressure': item.get('main', {}).get('pressure'),
        })

    return JsonResponse({'forecast': forecast_data})


@login_required(login_url='login')
def api_city_search(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return JsonResponse({'results': []})

    url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit=5&appid={OPENWEATHER_API_KEY}"
    try:
        data = requests.get(url, timeout=10).json()
    except:
        return JsonResponse({'error': 'Geocoding service unavailable'}, status=503)

    results = []
    if isinstance(data, list):
        for item in data:
            results.append({
                'name': item.get('name'),
                'state': item.get('state', ''),
                'country': item.get('country', ''),
                'lat': item.get('lat'),
                'lon': item.get('lon')
            })

    return JsonResponse({'results': results})

@login_required(login_url='login')
def api_chat_sessions(request):
    if request.method == 'GET':
        sessions = ChatSession.objects.filter(user=request.user).order_by('-created_at')
        session_data = []
        for s in sessions:
            last_msg = s.messages.order_by('-created_at').first()
            session_data.append({
                'id': s.id,
                'title': s.title,
                'created_at': s.created_at.strftime("%b %d, %Y %H:%M"),
                'last_message': last_msg.content[:50] + '...' if last_msg and len(last_msg.content) > 50 else (last_msg.content if last_msg else '')
            })
        return JsonResponse({'sessions': session_data})

@login_required(login_url='login')
def api_chat_session_detail(request, session_id):
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
    except ChatSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)

    if request.method == 'GET':
        messages = session.messages.order_by('created_at')
        msg_data = [{'role': m.role, 'content': m.content} for m in messages]
        return JsonResponse({'messages': msg_data, 'title': session.title})

    elif request.method == 'DELETE':
        session.delete()
        return JsonResponse({'success': True})

@login_required(login_url='login')
@require_POST
def api_chatbot(request):
    try:
        data = json.loads(request.body)
        user_message = data.get('message', '').strip()
        session_id = data.get('session_id')

        if not user_message:
            return JsonResponse(
                {'error': 'Message cannot be empty.'},
                status=400
            )

        if len(user_message) > 500:
            return JsonResponse(
                {'error': 'Message too long (max 500 characters).'},
                status=400
            )

        weather_data_texts = []

        try:
            city_prompt = f"""
Extract only the city name from this weather question.

Question:
{user_message}

Rules:
- Return ONLY the city name.
- If no city is found, return NONE.
"""

            city_model = genai.GenerativeModel("gemini-2.5-flash")
            city_response = city_model.generate_content(city_prompt)

            detected_city = city_response.text.strip()

            if detected_city.upper() != "NONE":
                message_lower = user_message.lower()

                # --- Detect timeframes ---
                past_keywords = ["yesterday", "past weather", "historical", "last week", "last month", "days ago"]
                is_past = any(kw in message_lower for kw in past_keywords)

                future_keywords = ["tomorrow", "forecast", "next day"]
                is_future = any(kw in message_lower for kw in future_keywords)

                today_keywords = ["today", "current", "now", "right now"]
                is_today = any(kw in message_lower for kw in today_keywords)

                # If no specific timeframe is mentioned, default to current (today)
                if not (is_past or is_future or is_today):
                    is_today = True

                if is_past:
                    # Try to detect how many days ago (simple logic)
                    days_ago = 1   # default to yesterday
                    if "2 days ago" in message_lower or "day before yesterday" in message_lower:
                        days_ago = 2
                    elif "3 days ago" in message_lower:
                        days_ago = 3
                    elif "last week" in message_lower:
                        days_ago = 7
                    elif "last month" in message_lower:
                        days_ago = 30

                    hist_info = get_historical_weather(detected_city, days_ago)
                    if hist_info:
                        weather_data_texts.append(f"""Historical Weather Data (Past):
City: {hist_info['city']}
Date: {hist_info['date']}
Max Temperature: {hist_info['max_temp']}°C
Min Temperature: {hist_info['min_temp']}°C
Precipitation: {hist_info['precipitation']} mm""")

                if is_future:
                    forecast_info = get_forecast_for_city(detected_city)
                    if forecast_info:
                        weather_data_texts.append(f"""Forecast Weather Data (Tomorrow):
City: {forecast_info['city']}
Temperature: {forecast_info['temperature']}°C
Humidity: {forecast_info['humidity']}%
Pressure: {forecast_info['pressure']} hPa
Wind Speed: {forecast_info['wind_speed']} m/s
Weather Condition: {forecast_info['description']}""")

                if is_today:
                    current_info = get_weather_for_city(detected_city)
                    if current_info:
                        weather_data_texts.append(f"""Live Weather Data (Today):
City: {current_info['city']}
Temperature: {current_info['temperature']}°C
Humidity: {current_info['humidity']}%
Pressure: {current_info['pressure']} hPa
Wind Speed: {current_info['wind_speed']} m/s
Weather Condition: {current_info['description']}""")

        except Exception:
            pass

        prompt = f"""
{WEATHER_SYSTEM_INSTRUCTION}

"""
        if weather_data_texts:
            prompt += "\n\n".join(weather_data_texts)
            
        prompt += f"""

IMPORTANT:
If weather data is provided above:
- Use the provided weather data as the absolute source of truth.
- Answer the user's question accurately using ONLY the provided data.
- If data for multiple timeframes (e.g., past, today, tomorrow) is provided, include them in your response appropriately.
- Do NOT make up any weather data.
- Do NOT ignore any provided weather values.
- Give a detailed and helpful answer.

User Question:
{user_message}
"""

        model = genai.GenerativeModel("gemini-2.5-flash")

        response = model.generate_content(prompt)

        reply = response.text

        if session_id:
            try:
                session = ChatSession.objects.get(id=session_id, user=request.user)
            except ChatSession.DoesNotExist:
                return JsonResponse({'error': 'Session not found'}, status=404)
        else:
            title = user_message[:30] + '...' if len(user_message) > 30 else user_message
            session = ChatSession.objects.create(user=request.user, title=title)

        ChatMessage.objects.create(session=session, role='user', content=user_message)
        ChatMessage.objects.create(session=session, role='bot', content=reply)

        return JsonResponse({
            'reply': reply,
            'session_id': session.id
        })

    except json.JSONDecodeError:
        return JsonResponse(
            {'error': 'Invalid JSON'},
            status=400
        )
    except Exception as e:
        error_message = str(e)

        if "429" in error_message:
            return JsonResponse(
                {
                    'reply': '⚠️ Weather AI is currently busy. Please wait a minute and try again.'
                }
            )

        return JsonResponse(
            {
                'reply': '⚠️ Something went wrong while contacting the AI service.'
            }
        )